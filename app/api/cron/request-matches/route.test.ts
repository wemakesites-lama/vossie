import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { config } from "@/proxy";
import { backfillRequestMatches } from "@/lib/data/request-reading";
import { resetRequest, type FakeRequest } from "@/tests/helpers/next-request";
import { GET } from "./route";

// The backfill of "Someone's looking for this" (AI stage G plan Task 6, planning decision 10), built as
// /api/cron/badges is: a 404 in sample mode or with the switch off, and behind CRON_SECRET on Supabase.
const request = vi.hoisted((): FakeRequest => ({ cookies: new Map(), sent: new Map(), proto: "http" }));
vi.mock("next/server", async () => (await import("@/tests/helpers/next-request")).nextServer());
vi.mock("next/cache", async () => (await import("@/tests/helpers/next-request")).nextCache(request));
vi.mock("@/lib/data/request-reading", () => ({
  backfillRequestMatches: vi.fn(async () => ({ matched: 2, unmatched: 1, more: false, capped: false })),
}));
const backfill = vi.mocked(backfillRequestMatches);

const SECRET = "c".repeat(64);
const call = (authorization?: string) =>
  GET(
    new Request("http://localhost/api/cron/request-matches", {
      headers: authorization === undefined ? {} : { Authorization: authorization },
    }),
  );

beforeEach(() => {
  resetRequest(request);
  backfill.mockClear();
  vi.stubEnv("CRON_SECRET", SECRET);
  vi.stubEnv("VOSSIE_AI_LOOKING_MATCH", "1");
  vi.stubEnv("VOSSIE_AI_PROVIDERS", "anthropic");
  vi.stubEnv("ANTHROPIC_API_KEY", "k");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("/api/cron/request-matches in sample mode", () => {
  it("is a 404 with no-store, even with the right secret, and reads nothing", async () => {
    vi.stubEnv("VOSSIE_BACKEND", "");
    const response = await call(`Bearer ${SECRET}`);
    expect(response.status).toBe(404);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(backfill).not.toHaveBeenCalled();
  });

  it("is never reached by proxy.ts without a session cookie", () => {
    expect(unstable_doesMiddlewareMatch({ config, url: "/api/cron/request-matches", cookies: {} })).toBe(false);
    expect(
      unstable_doesMiddlewareMatch({ config, url: "/api/cron/request-matches", headers: { authorization: `Bearer ${SECRET}` } }),
    ).toBe(false);
  });
});

describe("/api/cron/request-matches on Supabase", () => {
  beforeEach(() => {
    vi.stubEnv("VOSSIE_BACKEND", "supabase");
  });

  it("is a 404 with the switch off, and reads nothing", async () => {
    vi.stubEnv("VOSSIE_AI_LOOKING_MATCH", "");
    const response = await call(`Bearer ${SECRET}`);
    expect(response.status).toBe(404);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(backfill).not.toHaveBeenCalled();
  });

  it("refuses a call without exactly the secret, and every call while it's short or unset, reading nothing", async () => {
    for (const header of [undefined, `Bearer ${SECRET}x`, SECRET, "Bearer "]) {
      const response = await call(header);
      expect(response.status, String(header)).toBe(401);
      expect(response.headers.get("Cache-Control")).toBe("no-store");
    }
    vi.stubEnv("CRON_SECRET", "short");
    expect((await call("Bearer short")).status).toBe(401);
    vi.stubEnv("CRON_SECRET", "");
    expect((await call("Bearer ")).status).toBe(401);
    expect(backfill).not.toHaveBeenCalled();
  });

  it("runs one batch of the backfill and says how it went", async () => {
    const response = await call(`Bearer ${SECRET}`);
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toEqual({ matched: 2, unmatched: 1, more: false, capped: false });
    expect(backfill).toHaveBeenCalledOnce();
    expect(backfill.mock.calls[0][0]).toBeInstanceOf(Date);
  });
});
