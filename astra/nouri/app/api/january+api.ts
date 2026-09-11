import { allowedEndpoint, errorAction } from "../../lib/policy";
const limit = 5 * 1024 * 1024;
export async function POST(request: Request) {
  const reply = (code: string, status: number) =>
    Response.json(
      { code, message: errorAction(code, status) },
      { status, headers: { "Cache-Control": "no-store" } },
    );
  try {
    // Never import this route or its environment into client modules.
    const origin = request.headers.get("origin");
    // Match the public host across TLS-terminating reverse proxies.
    if (origin && new URL(origin).host !== new URL(request.url).host)
      return reply("forbidden", 403);
    if (Number(request.headers.get("content-length") ?? 0) > limit)
      return reply("payload_too_large", 413);
    const raw = await request.text();
    if (new TextEncoder().encode(raw).length > limit)
      return reply("payload_too_large", 413);
    let payload;
    try {
      payload = JSON.parse(raw);
    } catch {
      return reply("invalid_request", 400);
    }
    if (!payload || typeof payload !== "object")
      return reply("invalid_request", 400);
    const { method = "GET", path, query = {}, body, userId, etag } = payload;
    if (typeof path !== "string" || !allowedEndpoint(method, path))
      return reply("invalid_request", 400);
    const isLog = path.startsWith("/food-logs");
    if (
      isLog &&
      (typeof userId !== "string" ||
        !/^nouri-[a-zA-Z0-9-]{16,80}$/.test(userId))
    )
      return reply("end_user_id_required", 400);
    if (
      ["PATCH", "DELETE"].includes(method) &&
      (typeof etag !== "string" || etag.length > 256)
    )
      return reply("conflict", 412);
    const permitted =
      path === "/foods" || path === "/foods/autocomplete"
        ? ["query", "limit", "type"]
        : path === "/food-logs" && method === "GET"
          ? ["start_date", "end_date", "timezone"]
          : [];
    const params = new URLSearchParams();
    for (const key of permitted)
      if (query[key] != null) params.set(key, String(query[key]));
    const suffix = params.size ? `?${params}` : "";
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (isLog) headers["January-End-User-ID"] = userId;
    if (etag) headers["If-Match"] = etag;
    const override = process.env.JANUARY_PROXY_ORIGIN;
    let base = "https://partners.january.ai";
    if (override) {
      const u = new URL(override);
      if (
        u.protocol !== "http:" ||
        !["127.0.0.1", "localhost"].includes(u.hostname) ||
        u.pathname !== "/" ||
        u.username ||
        u.password
      )
        return reply("invalid_request", 500);
      base = u.origin;
    } else {
      const key = process.env.JANUARY_API_KEY;
      if (!key || key === "your_january_api_key")
        return reply("unauthorized", 401);
      headers.Authorization = `Bearer ${key}`;
    }
    const response = await fetch(`${base}/v1.2${path}${suffix}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(115000),
      redirect: "error",
    });
    const data = response.status === 204 ? null : await response.json();
    const safeHeaders = { "Cache-Control": "no-store" };
    if (!response.ok) {
      const code =
        response.status === 412
          ? "conflict"
          : (data?.code ??
            (response.status >= 500 ? "internal_error" : "invalid_request"));
      return Response.json(
        {
          code,
          message: errorAction(code, response.status),
          retryAfter: response.headers.get("retry-after"),
        },
        { status: response.status, headers: safeHeaders },
      );
    }
    return Response.json(
      { data, etag: response.headers.get("etag") ?? data?.etag ?? null },
      { headers: safeHeaders },
    );
  } catch {
    return reply("transport_error", 502);
  }
}
