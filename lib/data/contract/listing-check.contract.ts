import { afterEach, beforeEach, expect, it } from "vitest";
import { fileListingCheckReport } from "@/lib/data/reports";
import type { World } from "@/tests/contract/world";

// The listing check's reports (AI stage B, plan Task 6), the same in both backends: listing-check.test.ts runs it on the
// sample store (`pnpm test`), listing-check.db.test.ts on the local stack (`pnpm test:db`).

export function listingCheckContract(makeWorld: () => World): void {
  let world: World;
  beforeEach(() => {
    world = makeWorld();
  });
  afterEach(async () => {
    await world.cleanup();
  });

  it("files one open report about the seller's own live listing, refusing a draft and another account", async () => {
    const slug = await world.openShop("seller", { name: "Contract watches" });
    const live = await world.addListing(slug, { title: "Contract designer watch" });
    const draft = await world.addListing(slug, { title: "Contract draft watch" });
    await world.draftListing(draft);
    const owner = await world.signedIn("seller");
    const file = (listingId: string) =>
      world.asViewer("seller", () =>
        fileListingCheckReport({ listingId, ownerId: owner, concern: "counterfeit", now: new Date() }),
      );
    expect(await file(live)).toBe("filed");
    expect(await file(live)).toBe("already-open");
    expect(await file(draft)).toBe("not-found");
    const shopper = await world.signedIn("shopper");
    expect(
      await world.asViewer("shopper", () =>
        fileListingCheckReport({ listingId: live, ownerId: shopper, concern: "stolen", now: new Date() }),
      ),
    ).toBe("not-found");
  });
}
