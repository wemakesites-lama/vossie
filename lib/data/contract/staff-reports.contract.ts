import { afterEach, beforeEach, expect, it } from "vitest";
import { isRefused } from "@/lib/data/refused";
import {
  closeReport,
  closeReportsOn,
  countHidden,
  getHidden,
  getReport,
  listHidden,
  listReports,
  openReportCount,
} from "@/lib/data/staff-reports";
import { hideListing } from "@/lib/data/staff-shops";
import type { World } from "@/tests/contract/world";

// The Hub's reports queue and Show again's reads in both backends (C4/C5 plan Task 15; decision 11): a report's view
// (whether its target is there, why buyers can't see it, what the Hub can still do, and whose it is for the viewing
// admin), Dismiss, and the hidden lists. staff-reports.test.ts runs it on the sample store, staff-reports.db.test.ts on
// the local stack.

const NOW = () => new Date();
/** A short wait, so two hides never share a time (the lists sort by it). */
const tick = () => new Promise((resolve) => setTimeout(resolve, 5));

export function staffReportsContract(makeWorld: () => World): void {
  let world: World;
  beforeEach(async () => {
    world = makeWorld();
    await world.tidyCommunity();
    await world.tidyMessaging();
  });
  afterEach(async () => {
    await world.cleanup();
  });

  const asStaff = <T>(read: (staffId: string) => Promise<T>) => world.asViewer("staff", read);

  it("shows a listing's report with Hide and Pause, then hidden, and nothing to do once it's closed", async () => {
    const slug = await world.openShop("shopper");
    const listing = await world.addListing(slug, { title: "Contract reported lamp" });
    const id = await world.addReport("asker", { kind: "listing", id: listing });
    const view = await asStaff((staffId) => getReport(id, staffId));
    expect(view).toMatchObject({
      id,
      reporterName: "Asker",
      target: { kind: "listing", id: listing },
      targetTitle: "Contract reported lamp",
      reason: "spam",
      open: true,
      exists: true,
      unseen: null,
      shop: { slug, name: "Contract Shopper's shop" },
      can: { hide: true, pause: true },
      own: null,
    });
    expect((await asStaff(() => listReports())).some((report) => report.id === id)).toBe(true);
    expect(await asStaff(() => openReportCount())).toBeGreaterThanOrEqual(1);
    await asStaff(() => hideListing(listing, "Looks like a scam.", NOW()));
    // On Supabase hide_listing closed it; on the sample store the action closes it after the hide.
    if (world.name === "sample") await closeReportsOn({ kind: "listing", id: listing }, "hidden", "Looks like a scam.", "x", NOW());
    expect(await asStaff((staffId) => getReport(id, staffId))).toMatchObject({
      open: false,
      outcome: "hidden",
      note: "Looks like a scam.",
      closedByName: expect.any(String),
      exists: true,
      unseen: "hidden",
      can: { hide: false, pause: false },
    });
  });

  it("lets the Hub hide a reported request until it's hidden", async () => {
    const request = await world.addRequest({ asker: "seller", title: "A contract reported request", neededBy: null });
    const id = await world.addReport("asker", { kind: "request", id: request });
    expect(await asStaff((staffId) => getReport(id, staffId))).toMatchObject({
      exists: true,
      shop: null,
      can: { hide: true, pause: false },
      own: null,
    });
    await world.hideRequest(request, "Not allowed on the board.");
    expect(await asStaff((staffId) => getReport(id, staffId))).toMatchObject({ unseen: "hidden", can: { hide: false } });
  });

  it("shows a shop that has gone as gone, with no shop to pause", async () => {
    const slug = await world.openShop("shopper");
    const id = await world.addReport("asker", { kind: "seller", id: slug });
    expect(await asStaff((staffId) => getReport(id, staffId))).toMatchObject({ exists: true, can: { pause: true } });
    await world.closeShop(slug);
    expect(await asStaff((staffId) => getReport(id, staffId))).toMatchObject({
      exists: false,
      shop: null,
      unseen: null,
      can: { hide: false, pause: false },
    });
  });

  it("names the viewing admin's own shop, listing and request, with nothing to do; a deleted listing stays theirs", async () => {
    const slug = await world.openShop("staff");
    const listing = await world.addListing(slug, { title: "Contract staff's reported lamp" });
    const request = await world.addRequest({ asker: "staff", title: "A contract staff request", neededBy: null });
    const onShop = await world.addReport("asker", { kind: "seller", id: slug });
    const onListing = await world.addReport("asker", { kind: "listing", id: listing });
    const onRequest = await world.addReport("asker", { kind: "request", id: request });
    const none = { hide: false, pause: false };
    expect(await asStaff((staffId) => getReport(onShop, staffId))).toMatchObject({ own: "shop", can: none });
    expect(await asStaff((staffId) => getReport(onListing, staffId))).toMatchObject({ own: "listing", can: none });
    expect(await asStaff((staffId) => getReport(onRequest, staffId))).toMatchObject({ own: "request", can: none });
    // Without a viewer (the queue) nobody's own is named.
    expect(await asStaff(() => getReport(onShop, null))).toMatchObject({ own: null, can: { pause: true } });
    await world.deleteListing(listing);
    expect(await asStaff((staffId) => getReport(onListing, staffId))).toMatchObject({ exists: false, own: "listing", can: none });
    // Another admin sees none of it as theirs.
    await world.setRoles("asker", ["admin"]);
    expect(await world.asViewer("asker", (askerId) => getReport(onShop, askerId))).toMatchObject({ own: null, can: { pause: true } });
  });

  it("dismisses a report once, with its reporter and title", async () => {
    const slug = await world.openShop("shopper");
    const id = await world.addReport("asker", { kind: "seller", id: slug });
    const askerId = await world.signedIn("asker");
    expect(await asStaff((staffId) => closeReport(id, "No problem found.", staffId, NOW()))).toEqual({
      id,
      reporterId: askerId,
      title: "Contract Shopper's shop",
    });
    expect(await asStaff((staffId) => getReport(id, staffId))).toMatchObject({
      open: false,
      outcome: "dismissed",
      note: "No problem found.",
      closedByName: "Staff",
    });
    expect(await asStaff((staffId) => closeReport(id, "Again.", staffId, NOW()))).toBeNull();
  });

  it("refuses Dismiss on the admin's own shop on Supabase, changing nothing", async () => {
    if (world.name !== "supabase") return;
    const slug = await world.openShop("staff");
    const id = await world.addReport("asker", { kind: "seller", id: slug });
    const before = await world.auditCount();
    const error = await asStaff((staffId) => closeReport(id, "Mine.", staffId, NOW())).then(
      () => null,
      (thrown: unknown) => thrown,
    );
    expect(isRefused(error, "own-shop")).toBe(true);
    expect(await asStaff((staffId) => getReport(id, staffId))).toMatchObject({ open: true });
    expect(await world.auditCount()).toBe(before);
  });

  it("lists hidden listings and requests newest first, marking the admin's own", async () => {
    const theirs = await world.openShop("shopper");
    const mine = await world.openShop("staff");
    const theirListing = await world.addListing(theirs, { title: "Contract their hidden lamp" });
    const myListing = await world.addListing(mine, { title: "Contract my hidden lamp" });
    const theirRequest = await world.addRequest({ asker: "asker", title: "A contract their hidden request", neededBy: null });
    const myRequest = await world.addRequest({ asker: "staff", title: "A contract my hidden request", neededBy: null });
    const before = await asStaff(() => countHidden());
    // The admin's own is hidden by another admin (the verb); theirs, later, by the Hub's Hide (an open report first).
    await world.hideListing(myListing, "Not allowed either.");
    await tick();
    await world.addReport("asker", { kind: "listing", id: theirListing });
    await asStaff(() => hideListing(theirListing, "Not allowed.", NOW()));
    await world.hideRequest(theirRequest, "Not allowed.");
    await tick();
    await world.hideRequest(myRequest, "Not allowed either.");
    await world.pauseShop(theirs, "staff");
    const hidden = await asStaff((staffId) => listHidden(staffId));
    const listings = hidden.listings.filter((item) => [theirListing, myListing].includes(item.id));
    const requests = hidden.requests.filter((item) => [theirRequest, myRequest].includes(item.id));
    expect(listings.map(({ id, own, shopName, shopPausedByHub, reason, listingState }) => ({ id, own, shopName, shopPausedByHub, reason, listingState }))).toEqual([
      { id: theirListing, own: false, shopName: "Contract Shopper's shop", shopPausedByHub: true, reason: "Not allowed.", listingState: "available" },
      { id: myListing, own: true, shopName: "Contract Staff's shop", shopPausedByHub: false, reason: "Not allowed either.", listingState: "available" },
    ]);
    expect(requests.map(({ id, own, shopName, requestClosed }) => ({ id, own, shopName, requestClosed }))).toEqual([
      { id: myRequest, own: true, shopName: null, requestClosed: false },
      { id: theirRequest, own: false, shopName: null, requestClosed: false },
    ]);
    expect(await asStaff((staffId) => getHidden("request", theirRequest, staffId))).toMatchObject({
      kind: "request",
      title: "A contract their hidden request",
      campusSlug: "pretoria",
      own: false,
    });
    expect(await asStaff((staffId) => getHidden("listing", myListing, staffId))).toMatchObject({ own: true });
    expect(await asStaff((staffId) => getHidden("listing", theirRequest, staffId))).toBeNull();
    expect(await asStaff(() => countHidden())).toEqual({ listings: before.listings + 2, requests: before.requests + 2 });
  });

  it("has no closeReportsOn on Supabase: the staff function closed them", async () => {
    if (world.name !== "supabase") return;
    await expect(closeReportsOn({ kind: "listing", id: "x" }, "hidden", "x", "x", NOW())).rejects.toThrow(
      "the staff function closed them",
    );
  });
}
