import { describe, expect, it, vi } from "vitest";
import { forgetFollowsOf, notifyFollowers } from "@/lib/data/follows";
import { supabaseWorld } from "@/tests/db/supabase-world";
import { followsContract } from "./follows.contract";

// Following shops on the local stack (C4/C5 plan Task 7): follows, shops and storefronts read as the follower (the
// shops policy names a Hub-paused shop to its follower: amendment 3's probe), follow_shop, unfollow_shop and
// follower_count with the viewer's session; save_listing tells the followers.
vi.mock("@/lib/data/supabase/clients", async (original) => (await import("@/tests/db/viewer")).withViewerSeam(await original()));

describe("following shops on the local stack (C4/C5 plan Task 7)", () => {
  followsContract(supabaseWorld);
});

describe("what the database does itself on Supabase (C4/C5 plan decisions 10 and 16)", () => {
  it("notifyFollowers is a no-op: save_listing told the followers in its own transaction", async () => {
    const told = await notifyFollowers({
      sellerSlug: "tech-corner",
      shopName: "Tech corner",
      listing: { id: "l-001", title: "Anything" },
      now: new Date(),
    });
    expect(told).toBe(0);
  });

  it("deleting an account's follows is forget_account's, so the twin throws", async () => {
    await expect(forgetFollowsOf("anyone")).rejects.toThrow("forget_account does this");
  });
});
