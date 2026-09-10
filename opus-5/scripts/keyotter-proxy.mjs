#!/usr/bin/env node
/**
 * Local development only: forwards January v1.2 requests through `keyotter curl`, so the API key stays in
 * keyotter's store instead of a .env file.
 *
 *   npm run proxy:keyotter -- YOUR_KEYOTTER_CREDENTIAL_NAME     (or set KEYOTTER_CREDENTIAL)
 *   JANUARY_API_BASE_URL=http://127.0.0.1:8787 npm run web     (or put it in .env.local)
 *
 * keyotter caps request bodies at 1 MiB; the app's downsized photos fit comfortably.
 */
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';

const PORT = Number(process.env.KEYOTTER_PROXY_PORT) || 8787;
const CREDENTIAL = process.argv[2] || process.env.KEYOTTER_CREDENTIAL || 'JANUARY_API_KEY';
const UPSTREAM = 'https://partners.january.ai';
const MAX_BODY = 1024 * 1024;
// keyotter only reads request files from beneath its working directory.
const WORK_DIR = path.join(process.cwd(), '.keyotter-tmp');

function reply(res, status, code, message) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ code, message }));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY) {
        reject(Object.assign(new Error('Request body too large'), { tooLarge: true }));
        req.destroy();
      } else {
        chunks.push(chunk);
      }
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function keyotter(args) {
  return new Promise((resolve) => {
    const child = spawn('keyotter', args, { cwd: WORK_DIR, stdio: ['ignore', 'pipe', 'pipe'] });
    const out = [];
    const err = [];
    child.stdout.on('data', (chunk) => out.push(chunk));
    child.stderr.on('data', (chunk) => err.push(chunk));
    child.on('error', (e) => resolve({ code: -1, stdout: Buffer.alloc(0), stderr: String(e) }));
    child.on('close', (code) => resolve({ code, stdout: Buffer.concat(out), stderr: Buffer.concat(err).toString() }));
  });
}

// `curl -i` output: status line and headers, a blank line, then the body (after any 1xx preambles).
function parseResponse(raw) {
  let text = raw.toString('utf8');
  for (;;) {
    const split = text.indexOf('\r\n\r\n');
    if (split === -1) return null;
    const [statusLine, ...lines] = text.slice(0, split).split('\r\n');
    const status = Number(statusLine.split(' ')[1]);
    text = text.slice(split + 4);
    if (status >= 100 && status < 200) continue;
    const headers = {};
    for (const line of lines) {
      const i = line.indexOf(':');
      if (i > 0) headers[line.slice(0, i).trim().toLowerCase()] = line.slice(i + 1).trim();
    }
    return { status, headers, body: text };
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const method = (req.method ?? 'GET').toUpperCase();
  if (!url.pathname.startsWith('/v1.2/')) return reply(res, 404, 'not_found', 'Only /v1.2/* is proxied.');
  if (!['GET', 'POST', 'PATCH', 'DELETE'].includes(method)) {
    return reply(res, 405, 'invalid_request', 'Method not allowed.');
  }

  const args = [
    'curl', '-sS', '-i', '-m', '120', '-X', method,
    `${UPSTREAM}${url.pathname}${url.search}`,
    '-H', `Authorization: Bearer %${CREDENTIAL}%`,
    '-H', 'Accept: application/json',
  ];
  const endUser = req.headers['january-end-user-id'];
  if (typeof endUser === 'string') {
    if (!/^[\w.:@-]{1,128}$/.test(endUser)) return reply(res, 400, 'invalid_request', 'Malformed January-End-User-ID.');
    args.push('-H', `January-End-User-ID: ${endUser}`);
  }

  let bodyFile;
  try {
    await mkdir(WORK_DIR, { recursive: true });
    if (method === 'POST' || method === 'PATCH') {
      const body = await readBody(req);
      if (body.length) {
        bodyFile = `${randomUUID()}.json`;
        await writeFile(path.join(WORK_DIR, bodyFile), body);
        args.push('--json', `@${bodyFile}`);
      }
    }
    const result = await keyotter(args);
    const parsed = result.code === 0 ? parseResponse(result.stdout) : null;
    if (!parsed) {
      console.error(`[keyotter-proxy] ${method} ${url.pathname} failed (exit ${result.code}): ${result.stderr.trim()}`);
      return reply(res, 502, result.code === 5 ? 'upstream_error' : 'proxy_error', `keyotter exited with ${result.code}`);
    }
    const headers = { 'Content-Type': parsed.headers['content-type'] ?? 'application/json' };
    if (parsed.headers['retry-after']) headers['Retry-After'] = parsed.headers['retry-after'];
    res.writeHead(parsed.status, headers);
    res.end(parsed.status === 204 ? undefined : parsed.body);
    console.log(`[keyotter-proxy] ${method} ${url.pathname} → ${parsed.status}`);
  } catch (error) {
    if (error?.tooLarge) return reply(res, 413, 'payload_too_large', 'keyotter accepts request bodies up to 1 MiB.');
    reply(res, 500, 'proxy_error', String(error));
  } finally {
    if (bodyFile) await rm(path.join(WORK_DIR, bodyFile), { force: true });
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[keyotter-proxy] http://127.0.0.1:${PORT} → ${UPSTREAM} (credential ${CREDENTIAL})`);
});
