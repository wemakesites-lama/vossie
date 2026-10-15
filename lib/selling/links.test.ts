import { beforeEach, describe, expect, it, vi } from "vitest";
import { setShopPaused } from "@/lib/data/shops";
import { resetSampleStore } from "@/lib/data/store";
import { ownerLinkFor } from "./links";

const viewer = vi.hoisted(() => ({ id: null as string | null }));

vi.mock("@/lib/auth/session", async () => {
  const { getAccount } = await import("@/lib/data/accounts");
  return { getViewer: async () => (viewer.id ? getAccount(viewer.id) : null) };
});

beforeEach(() => {
  resetSampleStore();
  viewer.id = null;
});

describe("the owner's link (selling spec 2.12, plan decision 19)", () => {
  it("gives the owner Edit listing on their own listing, and Edit shop on their own storefront", async () => {
    viewer.id = "acc-seller";
    expect(await ownerLinkFor({ kind: "listing", listingId: "l-001" })).toEqual({
      href: "/sell/listings/l-001/edit",
      label: "Edit listing",
    });
    expect(await ownerLinkFor({ kind: "shop", sellerSlug: "tech-corner" })).toEqual({
      href: "/sell/profile",
      label: "Edit shop",
    });
  });

  it("gives a paused shop's owner the same links: its listing pages and storefront still show (amendment 13.8)", async () => {
    await setShopPaused("acc-seller", true);
    viewer.id = "acc-seller";
    expect(await ownerLinkFor({ kind: "listing", listingId: "l-001" })).toEqual({
      href: "/sell/listings/l-001/edit",
      label: "Edit listing",
    });
    expect(await ownerLinkFor({ kind: "shop", sellerSlug: "tech-corner" })).toEqual({
      href: "/sell/profile",
      label: "Edit shop",
    });
    expect(await ownerLinkFor({ kind: "listing", listingId: "l-004" })).toBeNull();
  });

  it("gives nobody else anything: another shop's listing or storefront, a student, a visitor", async () => {
    viewer.id = "acc-seller";
    expect(await ownerLinkFor({ kind: "listing", listingId: "l-004" })).toBeNull();
    expect(await ownerLinkFor({ kind: "shop", sellerSlug: "hair-studio" })).toBeNull();
    viewer.id = "acc-student";
    expect(await ownerLinkFor({ kind: "listing", listingId: "l-001" })).toBeNull();
    viewer.id = null;
    expect(await ownerLinkFor({ kind: "shop", sellerSlug: "tech-corner" })).toBeNull();
  });
});
