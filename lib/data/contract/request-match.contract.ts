import { afterEach, beforeEach, expect, it } from "vitest";
import {
  requestMatchCandidates,
  requestMatchOf,
  requestsWantingListing,
  saveRequestMatch,
  unreadRequests,
} from "@/lib/data/request-match";
import { sastDate } from "@/lib/time";
import type { MatchQuery } from "@/lib/types";
import type { World } from "@/tests/contract/world";

// "Someone's looking for this" (AI stage G, Task 4), the same in both backends: storing a request's search, the
// candidates a first publish is matched against (open, shown, an asker's, at one campus), and requestsWantingListing.
// request-match.test.ts runs it on the sample store, request-match.db.test.ts on the local stack.

const LAMP: MatchQuery = { q: "contract lamp", category: "tech", campus: "pretoria", price: null, pay: null, deals: null };

export function requestMatchContract(makeWorld: () => World): void {
  let world: World;
  let asker: string;
  let seller: string;
  let slug: string;
  beforeEach(async () => {
    world = makeWorld();
    await world.tidyCommunity();
    await world.tidyMessaging();
    asker = await world.signedIn("asker");
    seller = await world.signedIn("seller");
    slug = await world.openShop("seller");
  });
  afterEach(async () => {
    await world.cleanup();
  });

  const today = () => sastDate(new Date());
  const ask = async (title = "A contract lamp", who: "asker" | "seller" | "shopper" = "asker") => {
    const id = await world.addRequest({ asker: who, title, neededBy: null });
    expect(await saveRequestMatch(id, LAMP, true, new Date())).toBe(true);
    return id;
  };

  it("stores a search and reads it back for its asker only", async () => {
    const id = await ask();
    expect(await requestMatchOf(asker, id)).toMatchObject({ query: LAMP, readAt: expect.any(String) });
    expect(await requestMatchOf(seller, id)).toBeNull();
  });

  it("keeps a read with no search, and clears both", async () => {
    const id = await ask();
    await saveRequestMatch(id, null, true, new Date());
    expect(await requestMatchOf(asker, id)).toMatchObject({ query: null, readAt: expect.any(String) });
    await saveRequestMatch(id, null, false, new Date());
    expect(await requestMatchOf(asker, id)).toEqual({ query: null, readAt: null });
  });

  it("never stores one on a sample request", async () => {
    expect(await saveRequestMatch("r-001", LAMP, true, new Date())).toBe(false);
  });

  it("offers open, shown requests with a search at the campus, and lists the unread", async () => {
    const id = await ask();
    const unread = await world.addRequest({ asker: "shopper", title: "A contract kettle", neededBy: null });
    const hidden = await ask("A contract hidden lamp", "shopper");
    await world.hideRequest(hidden, "Testing");
    const ids = (await requestMatchCandidates("pretoria", today())).map((candidate) => candidate.id);
    expect(ids).toContain(id);
    expect(ids).not.toContain(unread);
    expect(ids).not.toContain(hidden);
    expect(await requestMatchCandidates("midrand", today())).toEqual([]);
    const unreadIds = (await unreadRequests(today(), 50)).map((row) => row.id);
    expect(unreadIds).toContain(unread);
    expect(unreadIds).not.toContain(id);
    expect(unreadIds).not.toContain(hidden);
  });

  it("counts the students a first publish answers, leaving out the seller's own and ones the shop offered on", async () => {
    await ask("A contract lamp");
    await ask("Another contract lamp");
    await ask("A contract lamp of my own", "seller");
    const offered = await ask("A contract lamp, offered", "shopper");
    await world.addOffer(slug, offered, "I have one.");
    const listingId = await world.addListing(slug, {
      title: "Contract lamp",
      categorySlug: "tech",
      description: "A lamp for the contract tests.",
    });
    const wanted = await world.asViewer("seller", () =>
      requestsWantingListing({ listingId, sellerSlug: slug, ownerId: seller, now: new Date() }),
    );
    expect(wanted?.students).toBe(1);
    expect(wanted?.requests).toHaveLength(1);
    // Both lamps are the asker's: one student, one request shown.
    expect(["A contract lamp", "Another contract lamp"]).toContain(wanted?.requests[0].title);
  });

  it("answers null for a listing buyers can't see", async () => {
    await ask();
    const listingId = await world.addListing(slug, { title: "Contract lamp", categorySlug: "tech" });
    await world.hideListing(listingId, "Testing");
    const wanted = await world.asViewer("seller", () =>
      requestsWantingListing({ listingId, sellerSlug: slug, ownerId: seller, now: new Date() }),
    );
    expect(wanted).toBeNull();
  });
}
