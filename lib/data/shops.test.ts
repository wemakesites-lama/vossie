import { beforeEach, describe, expect, it } from "vitest";
import { makeListingRow } from "@/tests/helpers/fakes";
import { pngBytes } from "@/tests/helpers/image-bytes";
import { addFollow, isFollowing } from "./follows";
import { getNotifications, notifyNewListing } from "./notifications";
import { getPhoto, photoIdOf, photoSrcsOf, storePhotos } from "./photos";
import {
  changeShopSlug,
  createShop,
  emptyDraft,
  exportShop,
  forgetShopOf,
  getOnboardingDraft,
  getShopOf,
  isShopNameTaken,
  isSlugTaken,
  restoreSampleShop,
  saveOnboardingDraft,
  setShopPaused,
  updateShop,
  type ShopDetails,
} from "./shops";
import { staffPauseShop } from "./staff-shops";
import { resetSampleStore, sampleStore } from "./store";

const NOW = new Date("2026-10-14T08:00:00.000Z");

const details: ShopDetails = {
  name: "Zola's Bakes",
  tagline: "Muffins on Mondays.",
  categorySlug: "food",
  about: "I bake between lectures.",
  image: null,
  campusSlug: "midrand",
  pickupPointIds: ["pp-midrand-library"],
};

const upload = () => ({ type: "image/png" as const, bytes: pngBytes() });
const applyAs = (accountId: string, overrides: Partial<ShopDetails> = {}) =>
  createShop(accountId, { ...details, ...overrides }, NOW);

beforeEach(() => {
  resetSampleStore();
});

describe("links a fixed route already uses (staff tools amendment 15.4)", () => {
  it("counts as taken, so the link can't be typed into Edit shop", async () => {
    expect(await isSlugTaken("export")).toBe(true);
    expect(await isSlugTaken("exports")).toBe(false);
    await applyAs("acc-student");
    sampleStore().sellerProfiles.get("acc-student")!.status = "approved";
    expect(await changeShopSlug("acc-student", "export", NOW)).toBe("taken");
    expect((await getShopOf("acc-student"))?.shop).toMatchObject({ slug: "zolas-bakes", slugChanged: false });
  });

  it("is never the link a new shop, or a waiting one renamed, is given", async () => {
    expect((await applyAs("acc-student", { name: "Export" }))?.slug).toBe("export-shop");
    expect((await applyAs("acc-mentor", { name: "Export", campusSlug: "pretoria", pickupPointIds: [] }))?.slug).toBe(
      "export-shop-2",
    );
    expect((await updateShop("acc-pending", { ...details, name: "EXPORT", campusSlug: "pretoria" }, NOW))?.slug).toBe(
      "export-shop-3",
    );
  });
});

describe("applying to sell (selling spec 2.6 and 2.7, plan decisions 1 and 16)", () => {
  it("makes a shop with a link from its name, and a seller profile waiting for the Hub, with no storefront yet", async () => {
    const shop = (await applyAs("acc-student"))!;
    expect(shop).toMatchObject({
      slug: "zolas-bakes",
      ownerId: "acc-student",
      verified: false,
      badge: "new-seller",
      since: "2026-10",
      slugChanged: false,
    });
    expect(sampleStore().sellerProfiles.get("acc-student")).toEqual({
      accountId: "acc-student",
      status: "pending",
      sellerSlug: null,
      appliedAt: NOW.toISOString(),
    });
    expect(await getShopOf("acc-student")).toEqual({ shop, status: "pending", pausedByHub: false });
  });

  it("makes every link unique, and never a second shop for one account", async () => {
    await applyAs("acc-student");
    expect((await applyAs("acc-mentor", { campusSlug: "pretoria" }))?.slug).toBe("zolas-bakes-2");
    expect(await applyAs("acc-student")).toBeNull();
    expect(await applyAs("acc-seller")).toBeNull();
  });

  it("knows a name taken on the same campus, however it's written", async () => {
    expect(await isShopNameTaken("TECH corner!", "midrand", null)).toBe(true);
    expect(await isShopNameTaken("Tech corner", "pretoria", null)).toBe(false);
    expect(await isShopNameTaken("Tech corner", "midrand", "tech-corner")).toBe(false);
  });

  it("keeps the wizard's draft and its photo, which become the shop's", async () => {
    const [photo] = await storePhotos("acc-student", [upload()], NOW);
    await saveOnboardingDraft({ ...emptyDraft("acc-student", "midrand", NOW), name: "Zola's Bakes", photoSrc: photo });
    expect((await getOnboardingDraft("acc-student"))?.photoSrc).toBe(photo);
    expect(await photoSrcsOf("acc-student", "draft", NOW)).toEqual(new Set([photo]));
    await applyAs("acc-student", { image: { src: photo, alt: "" } });
    expect(await getOnboardingDraft("acc-student")).toBeNull();
    expect(await photoSrcsOf("acc-student", "shop", NOW)).toEqual(new Set([photo]));
  });

  it("deletes a draft's photo once another replaces it", async () => {
    const [first, second] = await storePhotos("acc-student", [upload(), upload()], NOW);
    await saveOnboardingDraft({ ...emptyDraft("acc-student", "midrand", NOW), photoSrc: first });
    await saveOnboardingDraft({ ...emptyDraft("acc-student", "midrand", NOW), photoSrc: second });
    expect(await getPhoto(photoIdOf(first)!, NOW)).toBeNull();
    expect(await photoSrcsOf("acc-student", "draft", NOW)).toEqual(new Set([second]));
  });
});

describe("editing the shop (selling spec 2.11, plan decisions 16 and 17)", () => {
  it("changes the details, and a waiting shop's link follows its name", async () => {
    const shop = await updateShop(
      "acc-pending",
      { ...details, name: "Hook club", campusSlug: "pretoria", pickupPointIds: ["pp-pretoria-library"] },
      NOW,
    );
    expect(shop).toMatchObject({ slug: "hook-club", name: "Hook club", categorySlug: "food" });
    expect(sampleStore().sellers.has("crochet-corner")).toBe(false);
  });

  it("keeps an approved shop's link whatever its name", async () => {
    expect((await updateShop("acc-seller", { ...details, name: "Gadget corner" }, NOW))?.slug).toBe("tech-corner");
  });

  it("moves its listings to a new campus, and a pickup to one of its spots, or online when it has none", async () => {
    const pretoria = { ...details, name: "Tech corner", campusSlug: "pretoria", pickupPointIds: ["pp-pretoria-reception"] };
    await updateShop("acc-seller", pretoria, NOW);
    expect(sampleStore().listings.get("l-001")).toMatchObject({
      campusSlug: "pretoria",
      handover: "pickup",
      pickupPointId: "pp-pretoria-reception",
    });
    await updateShop("acc-seller", { ...pretoria, campusSlug: "online", pickupPointIds: [] }, NOW);
    expect(sampleStore().listings.get("l-001")).toMatchObject({
      campusSlug: "online",
      handover: "online",
      pickupPointId: null,
    });
  });

  it("keeps a listing on a retired pickup point, and moves only those on a point the seller removed (amendment 13.6)", async () => {
    const store = sampleStore();
    store.pickupPoints.set("pp-midrand-extra", {
      ...structuredClone(store.pickupPoints.get("pp-midrand-reception")!),
      id: "pp-midrand-extra",
      name: "Student centre",
    });
    Object.assign(store.listings.get("l-001")!, { handover: "pickup", pickupPointId: "pp-midrand-library" });
    store.listings.set(
      "l-moved",
      makeListingRow({ id: "l-moved", sellerSlug: "tech-corner", campusSlug: "midrand", pickupPointId: "pp-midrand-extra" }),
    );
    store.pickupPoints.get("pp-midrand-library")!.retiredAt = NOW.toISOString();
    await updateShop("acc-seller", { ...details, name: "Tech corner", pickupPointIds: ["pp-midrand-reception"] }, NOW);
    // The retired library keeps its listing; the point the seller dropped moves its listing to the shop's first point.
    expect(store.listings.get("l-001")).toMatchObject({ handover: "pickup", pickupPointId: "pp-midrand-library" });
    expect(store.listings.get("l-moved")).toMatchObject({ handover: "pickup", pickupPointId: "pp-midrand-reception" });
  });

  it("swaps the shop's photo, deleting the old one", async () => {
    const [first, second] = await storePhotos("acc-seller", [upload(), upload()], NOW);
    await updateShop("acc-seller", { ...details, image: { src: first, alt: "" } }, NOW);
    await updateShop("acc-seller", { ...details, image: { src: second, alt: "" } }, NOW);
    expect(await getPhoto(photoIdOf(first)!, NOW)).toBeNull();
    expect(await photoSrcsOf("acc-seller", "shop", NOW)).toEqual(new Set([second]));
  });

  it("changes an approved shop's link once, and its listings, profile, conversations and reports go with it", async () => {
    sampleStore().reports.set("rep-t1", {
      id: "rep-t1",
      reporterId: "acc-student",
      targetKind: "seller",
      targetId: "tech-corner",
      targetTitle: "Tech corner",
      reason: "spam",
      detail: "",
      status: "open",
      createdAt: NOW.toISOString(),
      targetOwnerId: "acc-seller",
    });
    expect(await changeShopSlug("acc-seller", "gadgets", NOW)).toBe("changed");
    const store = sampleStore();
    expect(store.sellers.has("tech-corner")).toBe(false);
    expect(store.sellers.get("gadgets")).toMatchObject({ name: "Tech corner", slugChanged: true });
    expect(store.listings.get("l-001")?.sellerSlug).toBe("gadgets");
    expect(store.sellerProfiles.get("acc-seller")?.sellerSlug).toBe("gadgets");
    expect([...store.conversations.values()].map((row) => row.sellerSlug)).toEqual(["gadgets", "gadgets"]);
    expect(store.reports.get("rep-t1")?.targetId).toBe("gadgets");
    expect(await changeShopSlug("acc-seller", "gadgets-two", NOW)).toBe("used");
  });

  it("moves a mentor's \"You're now mentoring\" notification to the shop's new link (role views N4)", async () => {
    const store = sampleStore();
    store.notifications.set("note-mentoring", {
      id: "note-mentoring",
      accountId: "acc-mentor",
      kind: "staff-role",
      subjectId: "tech-corner",
      text: "You're now mentoring Tech corner.",
      href: "/mentor/tech-corner",
      createdAt: NOW.toISOString(),
      readAt: null,
    });
    expect(await changeShopSlug("acc-seller", "gadgets", NOW)).toBe("changed");
    expect(store.notifications.get("note-mentoring")?.href).toBe("/mentor/gadgets");
  });

  it("moves Featured pins and recorded rows to the new link too (amendment 13.4)", async () => {
    const store = sampleStore();
    store.featuredPins.set("pin-t1", {
      id: "pin-t1",
      sellerSlug: "tech-corner",
      campusSlug: "midrand",
      day: "2026-10-14",
      pinnedBy: "acc-admin",
      createdAt: NOW.toISOString(),
    });
    store.featuredDraws.set("midrand:2026-10-14", {
      key: "midrand:2026-10-14",
      campusSlug: "midrand",
      day: "2026-10-14",
      sellerSlugs: ["tech-corner", "hair-studio"],
    });
    expect(await changeShopSlug("acc-seller", "gadgets", NOW)).toBe("changed");
    expect(store.featuredPins.get("pin-t1")?.sellerSlug).toBe("gadgets");
    expect(store.featuredDraws.get("midrand:2026-10-14")?.sellerSlugs).toEqual(["gadgets", "hair-studio"]);
  });

  it("leaves a gone shop's conversations on the old link, so no new owner of it can open them (amendment 9.1)", async () => {
    sampleStore().conversations.get("conv-s2")!.sellerGone = true;
    expect(await changeShopSlug("acc-seller", "gadgets", NOW)).toBe("changed");
    const links = new Map([...sampleStore().conversations.values()].map((row) => [row.id, row.sellerSlug]));
    expect(links.get("conv-s1")).toBe("gadgets");
    expect(links.get("conv-s2")).toBe("tech-corner");
  });

  it("keeps an old link reserved once it's changed: no other shop takes it, and it opens no shop (amendment 13.7)", async () => {
    expect(await changeShopSlug("acc-seller", "gadgets", NOW)).toBe("changed");
    const store = sampleStore();
    expect(store.sellers.get("gadgets")?.previousSlugs).toEqual(["tech-corner"]);
    expect(store.sellers.has("tech-corner")).toBe(false);
    expect(await isSlugTaken("tech-corner")).toBe(true);
    // Another approved shop can't change its link to it.
    await applyAs("acc-student", { campusSlug: "pretoria", pickupPointIds: [] });
    store.sellerProfiles.get("acc-student")!.status = "approved";
    expect(await changeShopSlug("acc-student", "tech-corner", NOW)).toBe("taken");
    // A new shop, or a waiting one renamed, with the same name gets the next free link instead.
    expect((await applyAs("acc-mentor", { name: "Tech corner", campusSlug: "pretoria", pickupPointIds: [] }))?.slug).toBe(
      "tech-corner-2",
    );
    expect((await updateShop("acc-pending", { ...details, name: "Tech corner", campusSlug: "pretoria" }, NOW))?.slug).toBe(
      "tech-corner-3",
    );
    // A waiting shop's link follows its name, so its old ones were never public and aren't kept.
    expect(store.sellers.get("tech-corner-3")?.previousSlugs).toEqual([]);
  });

  it("won't take another shop's link, or change a waiting shop's", async () => {
    expect(await changeShopSlug("acc-seller", "hair-studio", NOW)).toBe("taken");
    expect(await changeShopSlug("acc-seller", "tech-corner", NOW)).toBe("same");
    expect(await changeShopSlug("acc-pending", "lerato", NOW)).toBeNull();
  });
});

describe("pausing the shop (selling spec 2.8)", () => {
  it("pauses an approved shop and resumes a paused one, and nothing else", async () => {
    expect(await setShopPaused("acc-seller", true)).toBe("paused");
    expect(await setShopPaused("acc-seller", true)).toBeNull();
    expect(await setShopPaused("acc-seller", false)).toBe("approved");
    expect(await setShopPaused("acc-pending", true)).toBeNull();
    expect(await setShopPaused("acc-student", true)).toBeNull();
  });
});

describe("deleting and bringing back (plan decision 22, D's plan decision 15)", () => {
  it("removes an account's shop, its listings, its photos and its draft, and nothing of anyone else's", async () => {
    await storePhotos("acc-seller", [upload()], NOW);
    await storePhotos("acc-student", [upload()], NOW);
    await saveOnboardingDraft(emptyDraft("acc-seller", "midrand", NOW));
    expect(await forgetShopOf("acc-seller")).toBe(true);
    const store = sampleStore();
    expect(store.sellers.has("tech-corner")).toBe(false);
    expect(store.listings.has("l-001") || store.listings.has("l-007")).toBe(false);
    expect(store.listings.size).toBe(36);
    expect([...store.photos.values()].map((row) => row.ownerId)).toEqual(["acc-student"]);
    expect(store.onboardingDrafts.size).toBe(0);
    expect(await forgetShopOf("acc-student")).toBe(false);
  });

  it("takes the Featured pins on the shop with it, and nobody else's (amendment 14.7)", async () => {
    const pin = (id: string, sellerSlug: string, day: string) =>
      sampleStore().featuredPins.set(id, {
        id,
        sellerSlug,
        campusSlug: "midrand",
        day,
        pinnedBy: "acc-admin",
        createdAt: NOW.toISOString(),
      });
    pin("pin-a", "tech-corner", "2026-10-14");
    pin("pin-b", "tech-corner", "2026-10-20");
    pin("pin-c", "nail-bar", "2026-10-14");
    await forgetShopOf("acc-seller");
    expect([...sampleStore().featuredPins.keys()]).toEqual(["pin-c"]);
    // An account with no shop leaves the pins alone.
    await forgetShopOf("acc-student");
    expect(sampleStore().featuredPins.size).toBe(1);
  });

  it("puts a sample shop and its sample listings back, once", async () => {
    await forgetShopOf("acc-seller");
    expect(await restoreSampleShop("acc-seller")).toBe(true);
    expect(sampleStore().sellers.get("tech-corner")?.ownerId).toBe("acc-seller");
    expect(sampleStore().listings.has("l-001")).toBe(true);
    expect(await restoreSampleShop("acc-seller")).toBe(false);
    expect(await restoreSampleShop("acc-student")).toBe(false);
  });

  it("puts a sample shop back under a free link when another shop has taken its own, and its profile says so (amendment 9.3)", async () => {
    await forgetShopOf("acc-seller");
    const taker = (await applyAs("acc-student", { name: "Tech corner", campusSlug: "pretoria", pickupPointIds: [] }))!;
    expect(taker.slug).toBe("tech-corner");
    expect(await restoreSampleShop("acc-seller")).toBe(true);
    const store = sampleStore();
    // The other student's shop keeps the link; Tech corner comes back whole, one link along.
    expect(store.sellers.get("tech-corner")).toMatchObject({ ownerId: "acc-student" });
    expect(store.sellers.get("tech-corner-2")).toMatchObject({ ownerId: "acc-seller", name: "Tech corner" });
    expect(store.sellerProfiles.get("acc-seller")?.sellerSlug).toBe("tech-corner-2");
    expect(store.sellerProfiles.get("acc-student")?.sellerSlug).toBeNull();
    for (const id of ["l-001", "l-007"]) expect(store.listings.get(id)?.sellerSlug, id).toBe("tech-corner-2");
    expect((await getShopOf("acc-seller"))?.shop.slug).toBe("tech-corner-2");
    expect(await restoreSampleShop("acc-seller")).toBe(false);
  });

  it("keeps a waiting sample shop's profile without a link when it comes back under a new one", async () => {
    await forgetShopOf("acc-pending");
    await applyAs("acc-student", { name: "Crochet corner", campusSlug: "pretoria", pickupPointIds: [] });
    expect(await restoreSampleShop("acc-pending")).toBe(true);
    expect(sampleStore().sellers.get("crochet-corner-2")?.ownerId).toBe("acc-pending");
    expect(sampleStore().sellerProfiles.get("acc-pending")?.sellerSlug).toBeNull();
  });
});

describe("the data export (plan decision 22)", () => {
  it("gives the shop and its listings, with pickup points by name and photos by address, and no ids", async () => {
    const data = await exportShop("acc-seller");
    expect(data.shop).toMatchObject({
      name: "Tech corner",
      link: "tech-corner",
      status: "approved",
      approvedAt: "2026-03-01T08:00:00.000Z",
      category: "Tech",
      campus: "midrand",
      photo: "/stock/seller/tech-corner.jpg",
      pickupPoints: ["Library entrance", "Main reception"],
      since: "2026-03",
    });
    expect(data.listings.map((row) => row.title)).toEqual(["Casio fx-991ZA Plus calculator", "Gaming headset, barely used"]);
    expect(data.listings[0]).toMatchObject({
      state: "available",
      category: "Tech",
      pickupPoint: "Library entrance",
      photos: [
        { address: "/stock/listing/tech.jpg", description: "" },
        { address: "/placeholders/photo/2.svg", description: "The back of the calculator, with the battery cover" },
        { address: "/placeholders/photo/3.svg", description: "The slide-on cover" },
      ],
    });
    expect(JSON.stringify(data)).not.toMatch(/acc-seller|l-001|pp-midrand/);
    expect(await exportShop("acc-student")).toEqual({ shop: null, listings: [], onboardingDraft: null });
  });

  it("lists the links a shop has left, as addresses, since they are the seller's data (amendment 14.2)", async () => {
    expect((await exportShop("acc-seller")).shop?.previousLinks).toEqual([]);
    expect(await changeShopSlug("acc-seller", "gadgets", NOW)).toBe("changed");
    const { shop } = await exportShop("acc-seller");
    expect(shop).toMatchObject({ link: "gadgets", previousLinks: ["/sellers/tech-corner"] });
    // A waiting shop's link follows its name and was never public, so it has none to list.
    await updateShop("acc-pending", { ...details, name: "Crochet nook", campusSlug: "pretoria" }, NOW);
    expect((await exportShop("acc-pending")).shop?.previousLinks).toEqual([]);
  });

  it("says when each listing was first published, and none for a draft that never was", async () => {
    sampleStore().listings.set(
      "l-draft",
      makeListingRow({ id: "l-draft", title: "Not out yet", state: "draft", firstPublishedAt: null }),
    );
    const { listings } = await exportShop("acc-seller");
    const casio = listings.find((row) => row.title === "Casio fx-991ZA Plus calculator")!;
    expect(casio.firstPublishedAt).toBe(casio.createdAt);
    expect(listings.find((row) => row.title === "Not out yet")?.firstPublishedAt).toBeNull();
  });

  it("includes the wizard's answers when the account has a draft: the photo by its address, and no ids (amendment 9.6)", async () => {
    const [photo] = await storePhotos("acc-student", [upload()], NOW);
    await saveOnboardingDraft({
      ...emptyDraft("acc-student", "midrand", NOW),
      name: "Zola's Bakes",
      tagline: "Muffins on Mondays.",
      categorySlug: "food",
      about: "I bake between lectures.",
      photoSrc: photo,
      pickupPointIds: ["pp-midrand-library"],
    });
    const data = await exportShop("acc-student");
    expect(data.shop).toBeNull();
    expect(data.onboardingDraft).toEqual({
      name: "Zola's Bakes",
      tagline: "Muffins on Mondays.",
      category: "Food",
      about: "I bake between lectures.",
      photo,
      campus: "midrand",
      pickupPoints: ["Library entrance"],
      updatedAt: NOW.toISOString(),
    });
    expect(JSON.stringify(data)).not.toContain("acc-student");
  });

  it("leaves a half-filled draft's blanks as they are, and has no draft once the shop is sent", async () => {
    await saveOnboardingDraft(emptyDraft("acc-student", "midrand", NOW));
    expect((await exportShop("acc-student")).onboardingDraft).toMatchObject({ name: "", category: "", photo: null });
    await applyAs("acc-student");
    expect((await exportShop("acc-student")).onboardingDraft).toBeNull();
  });
});

describe("a pause the Hub made (staff tools plan decision 3)", () => {
  it("marks the seller's own pause as theirs, and won't let them resume the Hub's", async () => {
    const profile = sampleStore().sellerProfiles.get("acc-seller")!;
    expect(await setShopPaused("acc-seller", true)).toBe("paused");
    expect(profile.pausedBy).toBe("seller");
    expect(await setShopPaused("acc-seller", false)).toBe("approved");
    expect(profile.pausedBy).toBeNull();
    Object.assign(profile, { status: "paused", pausedBy: "staff", staffReason: "Selling exam answers." });
    expect(await setShopPaused("acc-seller", false)).toBeNull();
    expect(profile.status).toBe("paused");
  });

  it("tells the owner whose pause it is (C2/C3 plan decision 8)", async () => {
    expect((await getShopOf("acc-seller"))?.pausedByHub).toBe(false);
    await setShopPaused("acc-seller", true);
    expect(await getShopOf("acc-seller")).toMatchObject({ status: "paused", pausedByHub: false });
    await setShopPaused("acc-seller", false);
    await staffPauseShop("tech-corner", "Selling exam answers.");
    expect(await getShopOf("acc-seller")).toMatchObject({ status: "paused", pausedByHub: true });
  });
});

describe("a changed link keeps the shop's followers (community actions spec 2.15)", () => {
  it("moves its follows, and its followers' new-listing notifications, with it", async () => {
    const now = new Date("2026-10-14T08:42:00.000Z");
    await addFollow("acc-student", "tech-corner", now);
    const shop = { accountId: "acc-student", sellerSlug: "tech-corner", shopName: "Tech corner", now };
    await notifyNewListing({ ...shop, listing: { id: "l-001", title: "Casio fx-991ZA Plus calculator" } });
    await notifyNewListing({ ...shop, listing: { id: "l-007", title: "Gaming headset, barely used" } });
    expect(await changeShopSlug("acc-seller", "tech-corner-mdr", now)).toBe("changed");
    expect(await isFollowing("acc-student", "tech-corner-mdr")).toBe(true);
    expect(await isFollowing("acc-student", "tech-corner")).toBe(false);
    expect((await getNotifications("acc-student", 1))[0]).toMatchObject({
      kind: "new-listing",
      href: "/sellers/tech-corner-mdr",
    });
  });
});
