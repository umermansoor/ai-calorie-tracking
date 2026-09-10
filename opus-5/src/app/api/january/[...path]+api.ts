// Server-only proxy to January's partner API. The sk- key stays in the server environment and never
// reaches the browser or phone, and only the endpoints this app uses are forwarded.
//
// Env:
//   JANUARY_API_KEY       your v1.2 sk- key (required unless JANUARY_API_BASE_URL points at a proxy that
//                         authenticates for you, like scripts/keyotter-proxy.mjs)
//   JANUARY_API_BASE_URL  defaults to https://partners.january.ai

const DEFAULT_UPSTREAM = 'https://partners.january.ai';
const MAX_BODY_BYTES = 5 * 1024 * 1024; // January's own request cap
const UPSTREAM_TIMEOUT_MS = 120_000; // image analysis can take tens of seconds

const LOG_ID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.source;
const ROUTES: [method: string, path: RegExp][] = [
  ['GET', /^credits$/],
  ['GET', /^foods$/],
  ['GET', /^foods\/autocomplete$/],
  ['GET', /^foods\/barcode\/\d{6,14}$/],
  ['GET', /^foods\/\d{1,16}$/],
  ['POST', /^foods\/\d{1,16}\/alternatives$/],
  ['POST', /^food-analysis\/(image|text|corrections)$/],
  ['GET', /^food-logs$/],
  ['POST', /^food-logs$/],
  ['GET', new RegExp(`^food-logs/${LOG_ID}$`, 'i')],
  ['PATCH', new RegExp(`^food-logs/${LOG_ID}$`, 'i')],
  ['DELETE', new RegExp(`^food-logs/${LOG_ID}$`, 'i')],
  ['POST', /^glucose\/predictions$/],
];
const END_USER_ID = /^[\w.:@-]{1,128}$/;

const error = (status: number, code: string, message: string) =>
  Response.json({ code, message }, { status, headers: { 'Cache-Control': 'no-store' } });

let announcedUpstream = false;
let warnedNoKey = false;

async function proxy(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/api\/january\/?/, '');
  const method = request.method.toUpperCase();
  if (!ROUTES.some(([m, pattern]) => m === method && pattern.test(path))) {
    return error(404, 'not_found', `No such endpoint: ${method} /${path}`);
  }

  const upstream = (process.env.JANUARY_API_BASE_URL?.trim() || DEFAULT_UPSTREAM).replace(/\/+$/, '');
  const apiKey = process.env.JANUARY_API_KEY?.trim();
  if (!apiKey && upstream === DEFAULT_UPSTREAM) {
    if (!warnedNoKey) {
      warnedNoKey = true;
      console.warn('[january] JANUARY_API_KEY is not set. Get a key at developer.january.ai, add it to .env, and restart.');
    }
    return error(
      503,
      'not_configured',
      'No January API key is set. Get one at developer.january.ai and set JANUARY_API_KEY (see .env.example).',
    );
  }
  if (upstream !== DEFAULT_UPSTREAM && !announcedUpstream) {
    announcedUpstream = true;
    console.log(`[january] Sending API requests to ${upstream} (JANUARY_API_BASE_URL)`);
  }

  const headers = new Headers({ Accept: 'application/json' });
  if (apiKey) headers.set('Authorization', `Bearer ${apiKey}`);
  const endUserId = request.headers.get('January-End-User-ID');
  if (endUserId) {
    if (!END_USER_ID.test(endUserId)) return error(400, 'invalid_request', 'Malformed January-End-User-ID header.');
    headers.set('January-End-User-ID', endUserId);
  }

  let body: string | undefined;
  if (method === 'POST' || method === 'PATCH') {
    body = await request.text();
    if (body.length > MAX_BODY_BYTES) return error(413, 'payload_too_large', 'Request body is over 5 MB.');
    headers.set('Content-Type', 'application/json');
  }

  let res: Response;
  try {
    res = await fetch(`${upstream}/v1.2/${path}${url.search}`, {
      method,
      headers,
      body,
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
  } catch (e) {
    const timedOut = e instanceof Error && e.name === 'TimeoutError';
    // Node's fetch hides the real reason (e.g. ECONNREFUSED) in `cause`, sometimes inside an AggregateError.
    const cause =
      e instanceof Error
        ? (e.cause as { code?: string; message?: string; errors?: { code?: string }[] } | undefined)
        : undefined;
    const reason =
      cause?.code ?? cause?.errors?.[0]?.code ?? cause?.message ?? (e instanceof Error ? e.message : String(e));
    console.error(`[january] ${method} /${path} → ${upstream} failed: ${reason}`);
    if (timedOut) return error(504, 'upstream_timeout', 'January took too long to respond.');
    return error(
      502,
      'upstream_error',
      upstream === DEFAULT_UPSTREAM
        ? 'Could not reach January. Check the server’s internet connection.'
        : `Could not reach ${upstream} (set by JANUARY_API_BASE_URL). Start that proxy, or remove the variable to call January directly with JANUARY_API_KEY.`,
    );
  }

  const out = new Headers({ 'Cache-Control': 'no-store' });
  for (const name of ['Content-Type', 'Retry-After', 'January-Request-ID']) {
    const value = res.headers.get(name);
    if (value) out.set(name, value);
  }
  const payload = res.status === 204 ? null : await res.arrayBuffer();
  if (!res.ok) {
    // January errors are { code, message } (no secrets), so they're safe to log for whoever runs the server.
    const detail = payload ? new TextDecoder().decode(payload).slice(0, 300) : '';
    console.warn(`[january] ${method} /${path} → ${res.status} ${detail}`);
  }
  return new Response(payload, { status: res.status, headers: out });
}

export const GET = proxy;
export const POST = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
