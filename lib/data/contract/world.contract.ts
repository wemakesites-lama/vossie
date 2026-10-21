import { afterEach, beforeEach, expect, it } from "vitest";
import { getSeller, getSellerListings } from "@/lib/data";
import { hasOpenReport } from "@/lib/data/reports";
import type { World } from "@/tests/contract/world";

// The world's own verbs, checked once so later contracts can trust them (C4/C5 plan Task 3, decisions 13 to 15):
// setRoles, viewerAccount, openShop, addListing, publishListing, addReport and auditCount, each read back through the
// app's own readers where it has one. world.test.ts runs it on the sample store, world.db.test.ts on the local stack.

export function worldContract(makeWorld: () => World): void {
  let world: World;
  beforeEach(async () => {
    world = makeWorld();
    await world.tidySelling("shopper");
    await world.tidyMessaging();
  });
  afterEach(async () => {
    await world.cleanup();
  });

  it("setRoles gives an account roles, as getViewer reads them, and cleanup takes them back", async () => {
    expect((await world.viewerAccount("asker")).roles).toEqual([]);
    await world.setRoles("asker", ["admin"]);
    expect((await world.viewerAccount("asker")).roles).toEqual(["admin"]);
    await world.setRoles("asker", ["mentor", "admin"]);
    expect((await world.viewerAccount("asker")).roles).toEqual(["mentor", "admin"]);
    // The sample store needs no undo: each test's world starts from a fresh store.
    if (world.name === "sample") return;
    await world.cleanup();
    expect((await world.viewerAccount("asker")).roles).toEqual([]);
  });

  it("viewerAccount is the account as getViewer gives it", async () => {
    expect(await world.viewerAccount("staff")).toMatchObject({
      id: await world.signedIn("staff"),
      email: "contract-staff@vossie.test",
      firstName: "Staff",
      campusSlug: "pretoria",
      roles: ["admin"],
      seller: null,
    });
  });

  it("openShop opens an approved shop with a storefront, which cleanup closes", async () => {
    const slug = await world.openShop("shopper", { name: "Contract bakes" });
    expect(await getSeller(slug)).toMatchObject({ slug, name: "Contract bakes" });
    expect((await world.viewerAccount("shopper")).seller).toEqual({ status: "approved", sellerSlug: slug });
    if (world.name === "sample") return;
    await world.cleanup();
    expect(await getSeller(slug)).toBeNull();
    expect((await world.viewerAccount("shopper")).seller).toBeNull();
  });

  it("a waiting shop has no storefront and no link on the account yet", async () => {
    const slug = await world.openShop("shopper", { status: "pending" });
    expect(await getSeller(slug)).toBeNull();
    expect((await world.viewerAccount("shopper")).seller).toEqual({ status: "pending", sellerSlug: null });
  });

  it("addListing lists a listing buyers see in the shop", async () => {
    const slug = await world.openShop("shopper");
    const id = await world.addListing(slug, { title: "Contract kettle" });
    expect((await getSellerListings(slug)).map((listing) => [listing.id, listing.title])).toEqual([[id, "Contract kettle"]]);
  });

  it("publishListing publishes a new listing through the real path", async () => {
    const slug = await world.openShop("shopper");
    const id = await world.publishListing("shopper", slug, { title: "Contract toaster" });
    expect((await getSellerListings(slug)).map((listing) => listing.id)).toEqual([id]);
  });

  it("addReport makes an open report by the account", async () => {
    const slug = await world.openShop("shopper");
    const listing = await world.addListing(slug, { title: "Contract radio" });
    const request = await world.addRequest({ asker: "shopper", title: "A contract lamp", neededBy: null });
    for (const target of [
      { kind: "listing" as const, id: listing },
      { kind: "seller" as const, id: slug },
      { kind: "request" as const, id: request },
    ]) {
      expect(await world.asViewer("asker", (accountId) => hasOpenReport(accountId, target))).toBe(false);
      expect(await world.addReport("asker", target)).toEqual(expect.any(String));
      expect(await world.asViewer("asker", (accountId) => hasOpenReport(accountId, target))).toBe(true);
    }
  });

  it("auditCount counts the audit log, which reading doesn't change", async () => {
    const count = await world.auditCount();
    expect(count).toBeGreaterThanOrEqual(0);
    expect(await world.auditCount()).toBe(count);
  });
}
