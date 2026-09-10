import type {
  AlternativeFood,
  CreateFoodLogRequest,
  CreditBalance,
  DietPreference,
  Food,
  FoodAnalysisResult,
  FoodLog,
  GlucosePrediction,
  GlucosePredictionRequest,
  UpdateFoodLogRequest,
} from './types';

/**
 * Every January call goes through this app's own server route (src/app/api/january), which holds the
 * sk- API key. The browser/phone never sees the key.
 */
const BASE = '/api/january';

export class JanuaryError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly retryAfter?: number,
  ) {
    super(message);
    this.name = 'JanuaryError';
  }
}

type SendOptions = {
  query?: Record<string, string | number | undefined>;
  body?: unknown;
  endUserId?: string;
  /** Set false for non-idempotent writes: January may already have processed a request that failed. */
  retry?: boolean;
};

// Codes January says to retry once (rate limits only when Retry-After is present).
const TRANSIENT = new Set(['rate_limited', 'internal_error', 'upstream_error', 'service_unavailable', 'upstream_timeout']);
const MAX_RETRY_WAIT_S = 15;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function send<T>(method: string, path: string, opts: SendOptions = {}): Promise<T> {
  const params = Object.entries(opts.query ?? {})
    .filter(([, v]) => v !== undefined && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join('&');
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  if (opts.endUserId) headers['January-End-User-ID'] = opts.endUserId;

  let res: Response;
  try {
    res = await fetch(`${BASE}${path}${params ? `?${params}` : ''}`, {
      method,
      headers,
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    });
  } catch {
    throw new JanuaryError(0, 'network_error', 'Couldn’t reach the server. Check your connection and try again.');
  }

  if (res.status === 204) return undefined as T;
  const text = await res.text();
  let data: unknown;
  try {
    data = text ? JSON.parse(text) : undefined;
  } catch {
    data = undefined;
  }
  if (res.ok) return data as T;

  const body = (data ?? {}) as { code?: string; message?: string };
  const retryAfter = Number(res.headers.get('Retry-After'));
  const error = new JanuaryError(
    res.status,
    body.code ?? `http_${res.status}`,
    body.message ?? `Request failed (${res.status})`,
    Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : undefined,
  );

  const retryable =
    opts.retry !== false &&
    TRANSIENT.has(error.code) &&
    (error.code !== 'rate_limited' || (error.retryAfter !== undefined && error.retryAfter <= MAX_RETRY_WAIT_S));
  if (retryable) {
    await sleep((error.retryAfter ?? 2) * 1000);
    return send<T>(method, path, { ...opts, retry: false });
  }
  throw error;
}

const seg = encodeURIComponent;

export const january = {
  analyzeImage: (image: string) =>
    send<FoodAnalysisResult>('POST', '/food-analysis/image', { body: { image } }),
  analyzeText: (text: string) => send<FoodAnalysisResult>('POST', '/food-analysis/text', { body: { text } }),
  correctAnalysis: (analysis: FoodAnalysisResult, instruction: string) =>
    send<FoodAnalysisResult>('POST', '/food-analysis/corrections', { body: { analysis, instruction } }),

  searchFoods: (query: string, limit = 20) =>
    send<{ items: Food[] }>('GET', '/foods', { query: { query, limit } }),
  getFood: (id: string) => send<Food>('GET', `/foods/${seg(id)}`),
  getFoodByBarcode: (barcode: string) => send<Food>('GET', `/foods/barcode/${seg(barcode)}`),
  suggestAlternatives: (id: string, diet_preferences: DietPreference[]) =>
    send<{ alternatives: AlternativeFood[] }>('POST', `/foods/${seg(id)}/alternatives`, {
      body: { diet_preferences },
    }),

  listFoodLogs: (endUserId: string, start_date: string, end_date: string, timezone: string) =>
    send<{ items: FoodLog[] }>('GET', '/food-logs', { endUserId, query: { start_date, end_date, timezone } }),
  getFoodLog: (endUserId: string, id: string) => send<FoodLog>('GET', `/food-logs/${seg(id)}`, { endUserId }),
  createFoodLog: (endUserId: string, body: CreateFoodLogRequest) =>
    send<FoodLog>('POST', '/food-logs', { endUserId, body, retry: false }),
  updateFoodLog: (endUserId: string, id: string, body: UpdateFoodLogRequest) =>
    send<FoodLog>('PATCH', `/food-logs/${seg(id)}`, { endUserId, body, retry: false }),
  // Idempotent on January's side, so the default retry is safe.
  deleteFoodLog: (endUserId: string, id: string) => send<void>('DELETE', `/food-logs/${seg(id)}`, { endUserId }),

  predictGlucose: (body: GlucosePredictionRequest) =>
    send<GlucosePrediction>('POST', '/glucose/predictions', { body }),
  getCredits: () => send<CreditBalance>('GET', '/credits'),
};

/** Where developers get a January API key. */
export const API_KEY_URL = 'https://developer.january.ai';

const GET_A_KEY = 'Get one at developer.january.ai, add it to .env as JANUARY_API_KEY, then restart the server.';
const KEY_CODES = new Set([
  'not_configured',
  'unauthorized',
  'forbidden',
  'token_expired',
  'token_invalid',
  'token_revoked',
  'scope_insufficient',
]);

/** Whether the fix is to set up (or replace) the January API key. */
export const isApiKeyError = (error: unknown) =>
  error instanceof JanuaryError && (KEY_CODES.has(error.code) || error.status === 401 || error.status === 403);

/** The message shown on screen. Anything that could be a key problem says how to get one. */
export function errorMessage(error: unknown): string {
  if (!(error instanceof JanuaryError)) return error instanceof Error ? error.message : 'Something went wrong.';
  if (error.code === 'not_configured') return `No January API key is set up yet. ${GET_A_KEY}`;
  if (isApiKeyError(error)) {
    return `January rejected the API key. It should be a v1.2 key that starts with sk-. ${GET_A_KEY}`;
  }
  switch (error.code) {
    case 'credit_limit_exceeded':
      return 'This month’s January API credits are used up. They reset at the start of next month.';
    case 'rate_limited':
      return 'Too many requests right now. Try again in a moment.';
    case 'image_unreachable':
    case 'image_corrupt':
    case 'image_format_unsupported':
    case 'image_invalid_base64':
      return 'That image couldn’t be read. Try a clear JPG or PNG photo.';
    case 'payload_too_large':
      return 'That image is too large. Try a smaller photo.';
    case 'upstream_timeout':
      return 'The analysis took too long. Try again, ideally with a closer photo.';
    // These messages already say exactly what's wrong, and it isn't the key.
    case 'network_error':
    case 'upstream_error':
    case 'not_found':
    case 'invalid_request':
      return error.message;
    default:
      return `${error.message.replace(/\.?$/, '.')} If it keeps happening, check your January API key (developer.january.ai).`;
  }
}
