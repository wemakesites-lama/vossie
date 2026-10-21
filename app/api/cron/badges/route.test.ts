import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { config } from "@/proxy";
import { recalculateBadges } from "@/lib/data/badges";
import { resetRequest, type FakeRequest } from "@/tests/helpers/next-request";
import { GET } from "./route";

// The nightly badge job's Route Handler (C4 review fix 6; the controller's note after the C2/C3 fixes; Task 21b), built
// as /api/cron/photos is: in sample mode a 404 that nothing keeps, and no badge worked out (Overview does that there);
// on Supabase, behind CRON_SECRET, recalculateBadges, and `sellers` expired the way a Route Handler can, only when a
// badge changed. route.db.test.ts runs it on the local stack.
const request = vi.hoisted((): FakeRequest => ({ cookies: new Map(), sent: new Map(), proto: "http" }));
vi.mock("next/server", async () => (await import("@/tests/helpers/next-request")).nextServer());
vi.mock("next/cache", async () => (await import("@/tests/helpers/next-request")).nextCache(request));
const badges = vi.hoisted(() => ({ changed: [] as string[] }));
vi.mock("@/lib/data/badges", async (original) => {
  const actual = await original<typeof import("@/lib/data/badges")>();
  return {
    ...actual,
    recalculateBadges: vi.fn(async (now: Date) => (process.env.VOSSIE_BACKEND === "supabase" ? badges.changed : actual.recalculateBadges(now))),
  };
});

const SECRET = "c".repeat(64);
const call = (authorization?: string) =>
  GET(new Request("http://localhost/api/cron/badges", { headers: authorization === undefined ? {} : { Authorization: authorization } }));

beforeEach(() => {
  resetRequest(request);
  vi.mocked(recalculateBadges).mockClear();
  badges.changed = [];
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("/api/cron/badges in sample mode (C4 review fix 6)", () => {
  it("is a 404 with no-store, even with the right secret, and works nothing out", async () => {
    vi.stubEnv("CRON_SECRET", SECRET);
    const response = await call(`Bearer ${SECRET}`);
    expect(response.status).toBe(404);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(recalculateBadges).not.toHaveBeenCalled();
    expect(request.revalidatedTags).toEqual([]);
  });

  it("is never reached by proxy.ts without a session cookie, as a Vercel Cron call has none", () => {
    expect(unstable_doesMiddlewareMatch({ config, url: "/api/cron/badges", cookies: {} })).toBe(false);
    expect(unstable_doesMiddlewareMatch({ config, url: "/api/cron/badges", headers: { authorization: `Bearer ${SECRET}` } })).toBe(
      false,
    );
  });
});

describe("/api/cron/badges on Supabase (C4 review fix 6)", () => {
  beforeEach(() => {
    vi.stubEnv("VOSSIE_BACKEND", "supabase");
    vi.stubEnv("CRON_SECRET", SECRET);
  });

  it("refuses a call without exactly the secret, and every call while it's short or unset, working nothing out", async () => {
    for (const header of [undefined, `Bearer ${SECRET}x`, SECRET, "Bearer "]) {
      const response = await call(header);
      expect(response.status, String(header)).toBe(401);
      expect(response.headers.get("Cache-Control")).toBe("no-store");
    }
    vi.stubEnv("CRON_SECRET", "short");
    expect((await call("Bearer short")).status).toBe(401);
    vi.stubEnv("CRON_SECRET", "");
    expect((await call("Bearer ")).status).toBe(401);
    expect(recalculateBadges).not.toHaveBeenCalled();
  });

  it("works every owned shop's badge out, says how many changed, and expires sellers when any did", async () => {
    badges.changed = ["tech-corner", "thrift-row"];
    const before = Date.now();
    const response = await call(`Bearer ${SECRET}`);
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toEqual({ changed: 2 });
    expect(recalculateBadges).toHaveBeenCalledOnce();
    expect(vi.mocked(recalculateBadges).mock.calls[0][0].getTime()).toBeGreaterThanOrEqual(before);
    expect(request.revalidatedTags).toEqual([{ tag: "sellers", profile: { expire: 0 } }]);
  });

  it("expires nothing when no badge changed", async () => {
    const response = await call(`Bearer ${SECRET}`);
    expect(await response.json()).toEqual({ changed: 0 });
    expect(request.revalidatedTags).toEqual([]);
  });
});
