import { randomBytes } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TrustBadge } from "@/lib/types";
import { resetRequest, type FakeRequest } from "@/tests/helpers/next-request";
import { supabaseWorld, type SupabaseWorld } from "@/tests/db/supabase-world";
import { GET } from "./route";

// The nightly badge job on the local stack (C4 review fix 6; Task 21b): behind CRON_SECRET (a throwaway value made in
// the test), it works out every owned shop's badge with the admin client, writes the ones that changed, and expires
// `sellers` when any did; a second run finds nothing to change. The badges are put back after each test.
vi.mock("@/lib/data/supabase/clients", async (original) => (await import("@/tests/db/viewer")).withViewerSeam(await original()));
vi.mock("next/server", async () => (await import("@/tests/helpers/next-request")).nextServer());
const request = vi.hoisted((): FakeRequest => ({ cookies: new Map(), sent: new Map(), proto: "http" }));
vi.mock("next/cache", async () => (await import("@/tests/helpers/next-request")).nextCache(request));

const call = (authorization?: string) =>
  GET(new Request("http://localhost/api/cron/badges", { headers: authorization === undefined ? {} : { Authorization: authorization } }));

describe("/api/cron/badges on the local stack (C4 review fix 6)", () => {
  let world: SupabaseWorld;
  let secret: string;
  beforeEach(async () => {
    world = supabaseWorld();
    await world.keepBadges();
    resetRequest(request);
    secret = randomBytes(32).toString("hex");
    vi.stubEnv("CRON_SECRET", secret);
  });
  afterEach(async () => {
    vi.unstubAllEnvs();
    await world.cleanup();
  });

  const badgeOf = async (slug: string) => {
    const { data, error } = await world.admin.from("shops").select("badge").eq("slug", slug).single();
    if (error) throw new Error(error.message);
    return data.badge as TrustBadge | null;
  };
  const setBadge = async (slug: string, badge: TrustBadge) => {
    const { error } = await world.admin.from("shops").update({ badge }).eq("slug", slug);
    if (error) throw new Error(error.message);
  };

  it("refuses a call without the secret or with the wrong one, and changes no badge", async () => {
    expect((await call(`Bearer ${secret}`)).status).toBe(200);
    const earned = await badgeOf("tech-corner");
    const wrong: TrustBadge = earned === "trusted" ? "new-seller" : "trusted";
    await setBadge("tech-corner", wrong);
    resetRequest(request);
    for (const header of [undefined, `Bearer ${secret}x`, `Bearer ${"0".repeat(64)}`, secret]) {
      const response = await call(header);
      expect(response.status, String(header)).toBe(401);
      expect(response.headers.get("Cache-Control")).toBe("no-store");
    }
    expect(await badgeOf("tech-corner")).toBe(wrong);
    expect(request.revalidatedTags).toEqual([]);
  });

  it("puts back a badge the shop's record doesn't earn, expires sellers, and then finds nothing to change", async () => {
    // Anything the clock has moved since the seed is worked out first, so the count below is this test's.
    expect((await call(`Bearer ${secret}`)).status).toBe(200);
    const earned = await badgeOf("tech-corner");
    const wrong: TrustBadge = earned === "trusted" ? "new-seller" : "trusted";
    await setBadge("tech-corner", wrong);
    resetRequest(request);

    const response = await call(`Bearer ${secret}`);
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toEqual({ changed: 1 });
    expect(await badgeOf("tech-corner")).toBe(earned);
    expect(request.revalidatedTags).toEqual([{ tag: "sellers", profile: { expire: 0 } }]);

    resetRequest(request);
    expect(await (await call(`Bearer ${secret}`)).json()).toEqual({ changed: 0 });
    expect(request.revalidatedTags).toEqual([]);
  });
});
