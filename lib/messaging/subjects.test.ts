import { describe, expect, it } from "vitest";
import { composerSubject, reportSubject, shopSlugOf } from "./subjects";

describe("what a first message is about (messaging spec 3.1, plan decision 2)", () => {
  it("knows a listing's seller, campus, whether it takes swaps and whether it's open", async () => {
    expect(await composerSubject({ kind: "listing", listingId: "l-007" })).toMatchObject({
      listing: { id: "l-007", title: "Gaming headset, barely used" },
      seller: { slug: "tech-corner", name: "Tech corner" },
      campusName: "Midrand",
      swaps: true,
      open: true,
    });
    expect(await composerSubject({ kind: "listing", listingId: "l-001" })).toMatchObject({ swaps: false, open: true });
    expect(await composerSubject({ kind: "listing", listingId: "l-026" })).toMatchObject({ open: false });
    expect(await composerSubject({ kind: "listing", listingId: "l-016" })).toMatchObject({ open: false });
    expect(await composerSubject({ kind: "listing", listingId: "l-nope" })).toBeNull();
  });

  it("knows a shop, for a question with no listing and no swap", async () => {
    expect(await composerSubject({ kind: "shop", sellerSlug: "tech-corner" })).toMatchObject({
      listing: null,
      seller: { slug: "tech-corner" },
      campusName: "Midrand",
      swaps: false,
      open: true,
    });
    expect(await composerSubject({ kind: "shop", sellerSlug: "nope" })).toBeNull();
  });

  it("knows the account's own storefront, when it has one", () => {
    expect(shopSlugOf({ seller: { status: "approved", sellerSlug: "tech-corner" } })).toBe("tech-corner");
    expect(shopSlugOf({ seller: { status: "pending", sellerSlug: null } })).toBeNull();
    expect(shopSlugOf({ seller: null })).toBeNull();
  });
});

describe("what a report is about (messaging spec 3.4)", () => {
  it("names the listing, seller or request, with the way back to it", async () => {
    expect(await reportSubject({ kind: "listing", id: "l-001" })).toEqual({
      title: "Casio fx-991ZA Plus calculator",
      href: "/listings/l-001",
      backLabel: "Back to the listing",
    });
    expect(await reportSubject({ kind: "seller", id: "tech-corner" })).toEqual({
      title: "Tech corner",
      href: "/sellers/tech-corner",
      backLabel: "Back to the shop",
    });
    // Part B's request page ("Recheck" item 15).
    expect(await reportSubject({ kind: "request", id: "r-001" })).toEqual({
      title: "Accounting 1 tutor this week",
      href: "/looking-for/r-001",
      backLabel: "Back to the request",
    });
    expect(await reportSubject({ kind: "listing", id: "l-nope" })).toBeNull();
  });
});
