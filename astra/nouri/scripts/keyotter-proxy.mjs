// Local demo adapter. The secret is resolved only inside keyotter.
import http from "node:http";
import { spawn } from "node:child_process";
import { mkdir, writeFile, rm } from "node:fs/promises";
import { randomUUID } from "node:crypto";
const port = Number(process.env.KEYOTTER_PORT || 8788),
  maxCalls = Number(process.env.KEYOTTER_MAX_CALLS || 96);
let paidCalls = 0,
  busy = false;
const pending = new Set();
const allowed = (method, path) =>
  method === "GET"
    ? /^\/v1\.2\/(credits|foods|foods\/autocomplete|foods\/\d{1,16}|foods\/barcode\/\d{6,14}|food-logs)$/.test(
        path,
      )
    : method === "POST"
      ? /^\/v1\.2\/(food-analysis\/(image|text|corrections)|foods\/\d{1,16}\/alternatives|food-logs|glucose\/predictions)$/.test(
          path,
        )
      : ["PATCH", "DELETE"].includes(method) &&
        /^\/v1\.2\/food-logs\/[0-9a-f-]{36}$/.test(path);
const server = http.createServer(async (req, res) => {
  const send = (status, data) => {
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify(data));
  };
  const url = new URL(req.url, "http://127.0.0.1");
  if (
    req.headers.origin ||
    !["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(req.socket.remoteAddress)
  )
    return send(403, { code: "forbidden" });
  if (!allowed(req.method, url.pathname))
    return send(404, { code: "not_found" });
  const paid = url.pathname !== "/v1.2/credits";
  if (paid && paidCalls >= maxCalls)
    return send(429, { code: "credit_limit_exceeded" });
  if (busy) return send(429, { code: "rate_limited" });
  busy = true;
  let file;
  try {
    const chunks = [];
    let size = 0;
    for await (const chunk of req) {
      size += chunk.length;
      if (size > 1000000) {
        send(413, { code: "payload_too_large" });
        return;
      }
      chunks.push(chunk);
    }
    const data = Buffer.concat(chunks).toString();
    const args = [
      "curl",
      "-sS",
      "-i",
      "-m",
      "110",
      `https://partners.january.ai${url.pathname}${url.search}`,
      "-X",
      req.method,
      "-H",
      "Authorization: Bearer %JANUARY_AI_PROD_APIKEY%",
    ];
    for (const name of ["january-end-user-id", "if-match"])
      if (req.headers[name]) args.push("-H", `${name}: ${req.headers[name]}`);
    if (data) {
      await mkdir(".tmp", { recursive: true });
      file = `.tmp/${randomUUID()}.json`;
      pending.add(file);
      await writeFile(file, data, { mode: 0o600 });
      args.push("--json", `@${file}`);
    }
    if (paid) paidCalls++;
    console.log(
      `${new Date().toISOString()} ${req.method} ${url.pathname} | paid requests ${paidCalls}/${maxCalls}`,
    );
    const child = spawn("keyotter", args, {
      cwd: process.cwd(),
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    child.stdout.on("data", (chunk) => {
      output += chunk;
    });
    child.stderr.resume();
    const exit = await new Promise((resolve, reject) => {
      child.on("error", reject);
      child.on("close", resolve);
    });
    if (exit !== 0 || !output.startsWith("HTTP/"))
      return send(502, { code: "upstream_error" });
    const split = output.search(/\r?\n\r?\n/),
      head = output.slice(0, split),
      body = output.slice(split).replace(/^\r?\n\r?\n/, "");
    const status = Number(head.match(/^HTTP\/\S+ (\d+)/)?.[1] || 502);
    const headers = { "Content-Type": "application/json" };
    for (const name of ["etag", "retry-after"]) {
      const match = head.match(new RegExp(`^${name}:\\s*(.+)$`, "im"));
      if (match) headers[name] = match[1].trim();
    }
    res.writeHead(status, headers);
    res.end(body);
  } catch {
    if (!res.headersSent) send(502, { code: "upstream_error" });
  } finally {
    busy = false;
    if (file) {
      await rm(file, { force: true });
      pending.delete(file);
    }
  }
});
server.listen(port, "127.0.0.1", () =>
  console.log(
    `Keyotter adapter on 127.0.0.1:${port}; maximum ${maxCalls} paid requests. No automatic retries.`,
  ),
);
async function stop() {
  for (const p of pending) await rm(p, { force: true });
  server.close();
  process.exit(0);
}
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
