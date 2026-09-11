import test from "node:test";
import assert from "node:assert/strict";
import { POST } from "../app/api/january+api";
const req = (body: unknown, headers: Record<string, string> = {}) =>
  new Request("http://nouri.test/api/january", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
test("server rejects unused endpoints before doing any upstream work", async () => {
  const r = await POST(req({ path: "/auth/client-tokens", method: "POST" }));
  assert.equal(r.status, 400);
});
test("server refuses mutations without device identity", async () => {
  const r = await POST(
    req({ path: "/food-logs", method: "POST", body: { foods: [] } }),
  );
  assert.equal((await r.json()).code, "end_user_id_required");
});
test("server requires the day etag for every edit and delete", async () => {
  const r = await POST(
    req({
      path: "/food-logs/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      method: "PATCH",
      userId: "nouri-aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      body: { name: "Meal" },
    }),
  );
  assert.equal(r.status, 412);
});
test("malformed JSON is actionable invalid input, not a transport failure", async () => {
  const r = await POST(
    new Request("http://nouri.test/api/january", {
      method: "POST",
      body: "{bad",
    }),
  );
  assert.equal((await r.json()).code, "invalid_request");
});
test("server blocks requests from unrelated browser origins", async () => {
  const r = await POST(
    req({ path: "/credits" }, { origin: "https://unrelated.test" }),
  );
  assert.equal(r.status, 403);
});
test("server returns an actionable missing-key error without exposing values", async () => {
  delete process.env.JANUARY_API_KEY;
  delete process.env.JANUARY_PROXY_ORIGIN;
  const r = await POST(
    req({ path: "/credits" }, { origin: "https://nouri.test" }),
  );
  assert.equal(r.status, 401);
  assert.match((await r.json()).message, /developer.january.ai/);
});
test("server forwards only allowed headers and exposes data and etag, never its authorization", async () => {
  const originalFetch = global.fetch;
  process.env.JANUARY_API_KEY = "test-only-not-a-real-secret";
  let seen: any;
  global.fetch = async (url, options) => {
    seen = { url, options };
    return Response.json(
      { items: [] },
      { headers: { etag: 'W/"day-version"' } },
    );
  };
  try {
    const r = await POST(
      req({
        path: "/food-logs",
        method: "GET",
        userId: "nouri-aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
        query: {
          start_date: "2026-09-10",
          end_date: "2026-09-10",
          timezone: "America/Los_Angeles",
          redirect: "https://evil.test",
        },
      }),
    );
    const result = await r.json();
    assert.equal(result.etag, 'W/"day-version"');
    assert.equal(
      seen.options.headers["January-End-User-ID"],
      "nouri-aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    );
    assert.equal(
      seen.options.headers.Authorization,
      "Bearer test-only-not-a-real-secret",
    );
    assert.ok(!seen.url.includes("redirect"));
    assert.ok(!JSON.stringify(result).includes("test-only"));
  } finally {
    global.fetch = originalFetch;
    delete process.env.JANUARY_API_KEY;
  }
});
