import { afterEach, beforeEach, expect, it } from "vitest";
import { getHubPost, getHubPostIds, getHubPosts, getListedHubPostIds } from "@/lib/data";
import type { HubPostKind } from "@/lib/types";
import type { World } from "@/tests/contract/world";

// The Hub's public posts in both backends (2b plan Task 16): an event's count adds the RSVPs made on Vossie (staff
// tools plan decision 13), and a draft has no page and is in no list (decision 11). hub.test.ts runs it on the sample
// store, hub.db.test.ts on the local stack.

const ALL_KINDS: readonly HubPostKind[] = ["event", "office-hours", "tip"];
/** An event (Pitch night), and a tip. */
const EVENT = "h-001";
const TIP = "h-013";
/** Early enough that every sample event is still in the feed. */
const FROM = "2026-09-01";

export function hubContract(makeWorld: () => World): void {
  let world: World;
  beforeEach(() => {
    world = makeWorld();
  });
  afterEach(async () => {
    await world.cleanup();
  });

  it("adds a Vossie RSVP to an event's count, on its page and in the feed", async () => {
    const before = (await getHubPost(EVENT))?.going;
    expect(before).toEqual(expect.any(Number));
    await world.addRsvp(EVENT, "shopper");
    expect((await getHubPost(EVENT))?.going).toBe(before! + 1);
    const inFeed = (await getHubPosts({ kinds: ["event"], from: FROM })).find((post) => post.id === EVENT);
    expect(inFeed?.going).toBe(before! + 1);
    expect((await getHubPost(TIP))?.going).toBeNull();
  });

  it("gives a post taken back to a draft no page, and leaves it out of every list", async () => {
    expect(await getHubPostIds()).toContain(TIP);
    await world.unpublishPost(TIP);
    expect(await getHubPost(TIP)).toBeNull();
    expect(await getHubPostIds()).not.toContain(TIP);
    expect((await getHubPosts({ kinds: ALL_KINDS, from: FROM })).map((post) => post.id)).not.toContain(TIP);
    expect(await getListedHubPostIds({ today: FROM })).not.toContain(TIP);
  });
}
