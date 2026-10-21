import { afterEach, beforeEach, expect, it } from "vitest";
import { isRefused } from "@/lib/data/refused";
import {
  approveShop,
  declineShop,
  getShopForReview,
  hideListing,
  ownsListing,
  ownsRequest,
  ownsShop,
  resendForApproval,
  setShopMentor,
  setVerified,
  shopStanding,
  showListing,
  staffPauseShop,
  staffResumeShop,
} from "@/lib/data/staff-shops";
import type { World, WorldAccountName } from "@/tests/contract/world";

// The Hub's decisions about shops and listings in both backends (C4/C5 plan Task 14; decisions 2, 5 and 11): approve,
// decline and send again, Verified, the Hub's pause over a seller's own, mentors, hiding and showing a listing, and
// whose a shop, listing or request is. On Supabase each write is the staff function of the same name, with the
// admin's session; its gates (own shop, the role) are proven here at the data level on Supabase only, since the
// sample's data functions have none (Task 16 proves the actions on both). staff-shops.test.ts runs it on the sample
// store, staff-shops.db.test.ts on the local stack.

const NOW = () => new Date();

export function staffShopsContract(makeWorld: () => World): void {
  let world: World;
  beforeEach(async () => {
    world = makeWorld();
    await world.tidyCommunity();
    await world.tidyMessaging();
  });
  afterEach(async () => {
    await world.cleanup();
  });

  const asStaff = <T>(read: () => Promise<T>) => world.asViewer("staff", read);
  const review = (slug: string) => asStaff(() => getShopForReview(slug));

  it("approves a waiting shop once, and only for the owner the review named", async () => {
    const shopperId = await world.signedIn("shopper");
    const askerId = await world.signedIn("asker");
    const slug = await world.openShop("shopper", { status: "pending" });
    expect((await review(slug))?.standing).toBe("waiting");
    expect(await asStaff(() => approveShop(slug, askerId, NOW()))).toBeNull();
    expect(await asStaff(() => approveShop(slug, shopperId, NOW()))).toEqual({
      slug,
      name: "Contract Shopper's shop",
      ownerId: shopperId,
    });
    expect(await review(slug)).toMatchObject({ standing: "open", owner: { id: shopperId, firstName: "Shopper" } });
    expect(await asStaff(() => approveShop(slug, shopperId, NOW()))).toBeNull();
  });

  it("declines with the reason, and the seller's Send for approval again makes it wait again", async () => {
    const shopperId = await world.signedIn("shopper");
    const slug = await world.openShop("shopper", { status: "pending" });
    const decided = await asStaff(() => declineShop(slug, shopperId, "Add a photo of what you sell, please.", NOW()));
    expect(decided).toEqual({ slug, name: "Contract Shopper's shop", ownerId: shopperId });
    expect(await review(slug)).toMatchObject({ standing: "declined", staffReason: "Add a photo of what you sell, please." });
    expect(await asStaff(() => declineShop(slug, shopperId, "Again.", NOW()))).toBeNull();
    expect(await world.asViewer("shopper", (id) => resendForApproval(id, NOW()))).toBe(true);
    expect(await review(slug)).toMatchObject({ standing: "waiting", staffReason: null, declinedAt: null });
    expect(await world.asViewer("shopper", (id) => resendForApproval(id, NOW()))).toBe(false);
  });

  it("gives Verified, then nothing when it's Verified already", async () => {
    const slug = await world.openShop("shopper");
    const shopperId = await world.signedIn("shopper");
    expect(await asStaff(() => setVerified(slug, true))).toEqual({ slug, name: "Contract Shopper's shop", ownerId: shopperId });
    expect((await review(slug))?.shop.verified).toBe(true);
    expect(await asStaff(() => setVerified(slug, true))).toBeNull();
    expect(await asStaff(() => setVerified("no-such-shop", true))).toBeNull();
  });

  it("pauses over the seller's own pause, which Resume puts back; the seller sees the Hub's pause while it lasts", async () => {
    const slug = await world.openShop("shopper", { status: "paused", pausedBy: "seller" });
    const shopperId = await world.signedIn("shopper");
    expect(await asStaff(() => staffPauseShop(slug, "A buyer reported a scam."))).toMatchObject({ slug, ownerId: shopperId });
    expect(await review(slug)).toMatchObject({ standing: "paused", pausedBy: "staff", staffReason: "A buyer reported a scam." });
    expect(await world.asViewer("shopper", (id) => shopStanding(id))).toMatchObject({
      pausedByHub: true,
      reason: "A buyer reported a scam.",
    });
    expect(await asStaff(() => staffPauseShop(slug, "Again."))).toBeNull();
    expect(await asStaff(() => staffResumeShop(slug))).toEqual({
      slug,
      name: "Contract Shopper's shop",
      ownerId: shopperId,
      stillPausedBySeller: true,
    });
    expect(await review(slug)).toMatchObject({ standing: "paused", pausedBy: "seller", staffReason: null });
    expect(await world.asViewer("shopper", (id) => shopStanding(id))).toMatchObject({ pausedByHub: false, reason: null });
    expect(await asStaff(() => staffResumeShop(slug))).toBeNull();
  });

  it("resumes an open shop the Hub paused back to open", async () => {
    const slug = await world.openShop("shopper");
    await asStaff(() => staffPauseShop(slug, "A buyer reported a scam."));
    expect(await asStaff(() => staffResumeShop(slug))).toMatchObject({ slug, stillPausedBySeller: false });
    expect((await review(slug))?.standing).toBe("open");
  });

  it("assigns a mentor with the role, never the owner, never someone without it, and nothing for the same one", async () => {
    const slug = await world.openShop("shopper");
    const [askerId, shopperId, sellerId] = await Promise.all(
      (["asker", "shopper", "seller"] as const).map((name) => world.signedIn(name)),
    );
    await world.setRoles("asker", ["mentor"]);
    await world.setRoles("shopper", ["mentor"]);
    expect(await asStaff(() => setShopMentor(slug, askerId))).toEqual({
      slug,
      name: "Contract Shopper's shop",
      ownerId: shopperId,
      mentorName: "Asker",
    });
    expect((await review(slug))?.mentor).toEqual({ id: askerId, firstName: "Asker" });
    expect(await asStaff(() => setShopMentor(slug, askerId))).toBeNull();
    expect(await asStaff(() => setShopMentor(slug, shopperId))).toBeNull();
    expect(await asStaff(() => setShopMentor(slug, sellerId))).toBeNull();
    expect(await asStaff(() => setShopMentor(slug, null))).toMatchObject({ slug, mentorName: null });
    expect((await review(slug))?.mentor).toBeNull();
  });

  it("hides a reported listing once, and shows it again once", async () => {
    const slug = await world.openShop("shopper");
    const shopperId = await world.signedIn("shopper");
    const id = await world.addListing(slug, { title: "Contract hidden lamp" });
    await world.addReport("asker", { kind: "listing", id });
    expect(await asStaff(() => hideListing(id, "Looks like a scam.", NOW()))).toEqual({
      id,
      title: "Contract hidden lamp",
      sellerSlug: slug,
      state: "available",
      ownerId: shopperId,
    });
    expect(await asStaff(() => hideListing(id, "Again.", NOW()))).toBeNull();
    expect(await asStaff(() => showListing(id))).toEqual({
      id,
      title: "Contract hidden lamp",
      state: "available",
      ownerId: shopperId,
    });
    expect(await asStaff(() => showListing(id))).toBeNull();
  });

  it("knows whose a shop, a listing and a request are, a waiting shop's too", async () => {
    const staffId = await world.signedIn("staff");
    const own = await world.openShop("staff", { status: "pending" });
    const other = await world.openShop("shopper");
    const ownListing = await world.addListing(own, { title: "Contract staff's lamp" });
    const otherListing = await world.addListing(other, { title: "Contract shopper's lamp" });
    const ownRequest = await world.addRequest({ asker: "staff", title: "A contract staff request", neededBy: null });
    const otherRequest = await world.addRequest({ asker: "asker", title: "A contract asker request", neededBy: null });
    expect(await asStaff(() => ownsShop(staffId, own))).toBe(true);
    expect(await asStaff(() => ownsShop(staffId, other))).toBe(false);
    expect(await asStaff(() => ownsListing(staffId, ownListing))).toBe(true);
    expect(await asStaff(() => ownsListing(staffId, otherListing))).toBe(false);
    expect(await asStaff(() => ownsRequest(staffId, ownRequest))).toBe(true);
    expect(await asStaff(() => ownsRequest(staffId, otherRequest))).toBe(false);
    expect(await world.asViewer("shopper", (id) => ownsShop(id, own))).toBe(false);
  });

  // --- The SQL gates at the data level: Supabase only (the sample's data functions have none) ---------------------

  /** What a refusal must leave as it was: the shop's review, the audit log's size, and everyone's notifications. */
  const snapshot = async (slug: string) => ({
    review: await review(slug),
    audit: await world.auditCount(),
    notes: await Promise.all((["staff", "shopper", "asker", "seller"] satisfies WorldAccountName[]).map((name) => world.notificationsOf(name))),
  });

  const refusedWith = async (code: "own-shop" | "forbidden", write: () => Promise<unknown>) => {
    const error = await write().then(
      () => null,
      (thrown: unknown) => thrown,
    );
    expect(isRefused(error, code), String(error)).toBe(true);
  };

  it("refuses every decision about the admin's own shop and its listing with own-shop, changing nothing", async () => {
    if (world.name !== "supabase") return;
    const staffId = await world.signedIn("staff");
    const waiting = await world.openShop("staff", { status: "pending" });
    const before = await snapshot(waiting);
    await refusedWith("own-shop", () => asStaff(() => approveShop(waiting, staffId, NOW())));
    await refusedWith("own-shop", () => asStaff(() => declineShop(waiting, staffId, "My own shop.", NOW())));
    expect(await snapshot(waiting)).toEqual(before);
  });

  it("refuses Verified, the pause, Resume, a mentor, Hide and Show on the admin's own open shop, changing nothing", async () => {
    if (world.name !== "supabase") return;
    const slug = await world.openShop("staff");
    const listing = await world.addListing(slug, { title: "Contract staff's own lamp" });
    await world.addReport("asker", { kind: "listing", id: listing });
    await world.setRoles("asker", ["mentor"]);
    const askerId = await world.signedIn("asker");
    const before = await snapshot(slug);
    await refusedWith("own-shop", () => asStaff(() => setVerified(slug, true)));
    await refusedWith("own-shop", () => asStaff(() => staffPauseShop(slug, "My own shop.")));
    await refusedWith("own-shop", () => asStaff(() => staffResumeShop(slug)));
    await refusedWith("own-shop", () => asStaff(() => setShopMentor(slug, askerId)));
    await refusedWith("own-shop", () => asStaff(() => hideListing(listing, "My own listing.", NOW())));
    await world.hideListing(listing, "Hidden by another admin.");
    const hidden = await snapshot(slug);
    await refusedWith("own-shop", () => asStaff(() => showListing(listing)));
    expect(await snapshot(slug)).toEqual(hidden);
    expect(hidden.audit).toBe(before.audit);
  });

  it("refuses someone without the admin role with forbidden, changing nothing", async () => {
    if (world.name !== "supabase") return;
    const shopperId = await world.signedIn("shopper");
    const waiting = await world.openShop("shopper", { status: "pending" });
    const asAsker = <T>(write: () => Promise<T>) => world.asViewer("asker", write);
    const before = await snapshot(waiting);
    await refusedWith("forbidden", () => asAsker(() => approveShop(waiting, shopperId, NOW())));
    await refusedWith("forbidden", () => asAsker(() => declineShop(waiting, shopperId, "Not mine to say.", NOW())));
    expect(await snapshot(waiting)).toEqual(before);

    const open = await world.openShop("seller");
    const listing = await world.addListing(open, { title: "Contract seller's lamp" });
    await world.addReport("shopper", { kind: "listing", id: listing });
    const opened = await snapshot(open);
    await refusedWith("forbidden", () => asAsker(() => setVerified(open, true)));
    await refusedWith("forbidden", () => asAsker(() => staffPauseShop(open, "Not mine to say.")));
    await refusedWith("forbidden", () => asAsker(() => staffResumeShop(open)));
    await refusedWith("forbidden", () => asAsker(() => setShopMentor(open, null)));
    await refusedWith("forbidden", () => asAsker(() => hideListing(listing, "Not mine to say.", NOW())));
    await refusedWith("forbidden", () => asAsker(() => showListing(listing)));
    expect(await snapshot(open)).toEqual(opened);
  });

  it("hides nothing without an open report on Supabase (no-open-report)", async () => {
    if (world.name !== "supabase") return;
    const slug = await world.openShop("shopper");
    const listing = await world.addListing(slug, { title: "Contract unreported lamp" });
    const before = await world.auditCount();
    expect(await asStaff(() => hideListing(listing, "Nobody reported it.", NOW()))).toBeNull();
    expect(await world.auditCount()).toBe(before);
  });
}
