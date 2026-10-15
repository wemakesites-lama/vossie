import { beforeEach, describe, expect, it } from "vitest";
import { pngBytes } from "@/tests/helpers/image-bytes";
import { deleteAccountData, restoreSampleAccount } from "./accounts";
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
  type ShopEdit,
} from "./shops";
import { shopStats } from "./shop-stats";
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

/** Edit shop's form with the same details, keeping the photo and the link. */
const edit: ShopEdit = { ...details, image: "keep", slug: null };

const upload = () => ({ type: "image/png" as const, bytes: pngBytes() });
/** The new shop, or null when nothing was made. */
const applyAs = async (accountId: string, overrides: Partial<ShopDetails> = {}) =>
  (await createShop(accountId, { ...details, ...overrides }, NOW))?.shop ?? null;

/** What stage G's approval will do: the shop's link becomes its storefront. */
function approve(accountId: string): void {
  const store = sampleStore();
  const shop = [...store.sellers.values()].find((row) => row.ownerId === accountId)!;
  const profile = store.sellerProfiles.get(accountId)!;
  store.sellerProfiles.set(accountId, { ...profile, status: "approved", sellerSlug: shop.slug });
}

beforeEach(() => {
  resetSampleStore();
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
    expect(await getShopOf("acc-student")).toEqual({ shop, status: "pending" });
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
    expect(await photoSrcsOf("acc-student", "draft")).toEqual(new Set([photo]));
    await applyAs("acc-student", { image: { src: photo, alt: "" } });
    expect(await getOnboardingDraft("acc-student")).toBeNull();
    expect(await photoSrcsOf("acc-student", "shop")).toEqual(new Set([photo]));
  });

  it("deletes a draft's photo once another replaces it", async () => {
    const [first, second] = await storePhotos("acc-student", [upload(), upload()], NOW);
    await saveOnboardingDraft({ ...emptyDraft("acc-student", "midrand", NOW), photoSrc: first });
    await saveOnboardingDraft({ ...emptyDraft("acc-student", "midrand", NOW), photoSrc: second });
    expect(await getPhoto(photoIdOf(first)!)).toBeNull();
    expect(await photoSrcsOf("acc-student", "draft")).toEqual(new Set([second]));
  });
});

describe("editing the shop (selling spec 2.11, plan decisions 16 and 17)", () => {
  it("changes the details, and a waiting shop's link follows its name", async () => {
    const saved = await updateShop(
      "acc-pending",
      { ...edit, name: "Hook club", campusSlug: "pretoria", pickupPointIds: ["pp-pretoria-library"] },
      NOW,
    );
    expect(saved?.shop).toMatchObject({ slug: "hook-club", name: "Hook club", categorySlug: "food" });
    expect(sampleStore().sellers.has("crochet-corner")).toBe(false);
  });

  it("keeps an approved shop's link whatever its name", async () => {
    expect((await updateShop("acc-seller", { ...edit, name: "Gadget corner" }, NOW))?.shop?.slug).toBe("tech-corner");
  });

  it("moves its listings to a new campus, and a pickup to one of its spots, or online when it has none", async () => {
    const pretoria = { ...edit, name: "Tech corner", campusSlug: "pretoria", pickupPointIds: ["pp-pretoria-reception"] };
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

  it("swaps the shop's photo, deleting the old one", async () => {
    const [first, second] = await storePhotos("acc-seller", [upload(), upload()], NOW);
    await updateShop("acc-seller", { ...edit, image: { src: first, alt: "" } }, NOW);
    await updateShop("acc-seller", { ...edit, image: { src: second, alt: "" } }, NOW);
    expect(await getPhoto(photoIdOf(first)!)).toBeNull();
    expect(await photoSrcsOf("acc-seller", "shop")).toEqual(new Set([second]));
  });

  it("keeps the photo the shop has when the edit saves, not one it had when the edit began", async () => {
    const [first] = await storePhotos("acc-seller", [upload()], NOW);
    await updateShop("acc-seller", { ...edit, image: { src: first, alt: "" } }, NOW);
    await updateShop("acc-seller", { ...edit, image: "remove" }, NOW);
    expect((await updateShop("acc-seller", { ...edit, tagline: "Kept." }, NOW))?.shop?.image).toBeNull();
    expect(await photoSrcsOf("acc-seller", "shop")).toEqual(new Set());
  });

  it("keeps one shop photo when two new ones arrive at once, deleting the one replaced", async () => {
    const [first, second] = await storePhotos("acc-seller", [upload(), upload()], NOW);
    await Promise.all([
      updateShop("acc-seller", { ...edit, image: { src: first, alt: "" } }, NOW),
      updateShop("acc-seller", { ...edit, image: { src: second, alt: "" } }, NOW),
    ]);
    expect((await getShopOf("acc-seller"))?.shop.image?.src).toBe(second);
    expect(await photoSrcsOf("acc-seller", "shop")).toEqual(new Set([second]));
  });

  it("refuses a name another shop on the campus has by the time it saves, saving nothing", async () => {
    const saved = await updateShop("acc-pending", { ...edit, name: "TECH corner!", tagline: "Lost." }, NOW);
    expect(saved).toEqual({ shop: null, error: "name-taken" });
    expect((await getShopOf("acc-pending"))?.shop).toMatchObject({ name: "Crochet corner", slug: "crochet-corner" });
    expect(await createShop("acc-student", { ...details, name: "Tech Corner" }, NOW)).toEqual({
      shop: null,
      error: "name-taken",
    });
    expect(await getShopOf("acc-student")).toBeNull();
  });

  it("changes the link with the rest of the edit, or saves nothing when the link can't change", async () => {
    const saved = await updateShop("acc-seller", { ...edit, name: "Tech corner", tagline: "New.", slug: "gadgets" }, NOW);
    expect(saved?.shop).toMatchObject({ slug: "gadgets", slugChanged: true, tagline: "New." });
    expect(sampleStore().listings.get("l-001")?.sellerSlug).toBe("gadgets");
    // Asked again (a double click), the link is already the one asked for: the rest saves.
    const again = await updateShop("acc-seller", { ...edit, name: "Tech corner", tagline: "Again.", slug: "gadgets" }, NOW);
    expect(again?.shop).toMatchObject({ slug: "gadgets", tagline: "Again." });
    const spent = await updateShop("acc-seller", { ...edit, name: "Tech corner", tagline: "No.", slug: "gizmos" }, NOW);
    expect(spent).toEqual({ shop: null, error: "slug-used" });
    resetSampleStore();
    const taken = await updateShop("acc-seller", { ...edit, name: "Tech corner", tagline: "No.", slug: "hair-studio" }, NOW);
    expect(taken).toEqual({ shop: null, error: "slug-taken" });
    expect((await getShopOf("acc-seller"))?.shop).toMatchObject({ slug: "tech-corner", slugChanged: false });
    expect((await getShopOf("acc-seller"))?.shop.tagline).not.toBe("No.");
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

  it("won't take another shop's link, or change a waiting shop's", async () => {
    expect(await changeShopSlug("acc-seller", "hair-studio", NOW)).toBe("taken");
    expect(await changeShopSlug("acc-seller", "tech-corner", NOW)).toBe("same");
    expect(await changeShopSlug("acc-pending", "lerato", NOW)).toBeNull();
  });

  it("makes one change when two arrive at once: the second finds it made, or the change spent", async () => {
    const twice = await Promise.all([
      changeShopSlug("acc-seller", "gadgets", NOW),
      changeShopSlug("acc-seller", "gadgets", NOW),
    ]);
    expect(twice).toEqual(["changed", "same"]);
    resetSampleStore();
    const different = await Promise.all([
      changeShopSlug("acc-seller", "gadgets", NOW),
      changeShopSlug("acc-seller", "gizmos", NOW),
    ]);
    expect(different).toEqual(["changed", "used"]);
    expect([...sampleStore().sellers.keys()]).toContain("gadgets");
    expect(sampleStore().sellers.has("gizmos")).toBe(false);
  });

  it("edits the shop at its new link when the link changes while the edit is on its way", async () => {
    const [, edited] = await Promise.all([
      changeShopSlug("acc-seller", "gadgets", NOW),
      updateShop("acc-seller", { ...edit, name: "Tech corner", tagline: "At the new link." }, NOW),
    ]);
    expect(edited?.shop).toMatchObject({ slug: "gadgets", tagline: "At the new link." });
    expect(sampleStore().sellers.get("gadgets")?.tagline).toBe("At the new link.");
  });

  it("retires a changed link for good, so no other shop gets it and old links 404", async () => {
    await changeShopSlug("acc-seller", "gadgets", NOW);
    expect(await isSlugTaken("tech-corner")).toBe(true);
    // On other campuses, as "Tech corner" is still taken at Midrand.
    expect((await applyAs("acc-student", { name: "Tech corner", campusSlug: "pretoria" }))?.slug).toBe("tech-corner-2");
    const elsewhere = { ...edit, name: "Tech corner", campusSlug: "bedfordview", pickupPointIds: [] };
    expect((await updateShop("acc-pending", elsewhere, NOW))?.shop?.slug).toBe("tech-corner-3");
    approve("acc-student");
    expect(await changeShopSlug("acc-student", "tech-corner", NOW)).toBe("taken");
    expect(sampleStore().sellers.has("tech-corner")).toBe(false);
  });
});

describe("a deleted shop's link (plan decision 16)", () => {
  it("is retired, so a new shop with the deleted one's name gets another link and none of its history", async () => {
    await deleteAccountData("acc-seller");
    expect(await isSlugTaken("tech-corner")).toBe(true);
    const shop = (await applyAs("acc-student", { name: "Tech corner" }))!;
    expect(shop.slug).toBe("tech-corner-2");
    const none = { enquiries: 0, due: 0, repliedInTime: 0, salesConfirmed: 0 };
    expect(await shopStats(shop.slug, NOW)).toEqual({ week: none, record: none });
    expect(await shopStats("tech-corner", NOW)).toEqual({ week: none, record: none });
    approve("acc-student");
    expect(await changeShopSlug("acc-student", "tech-corner", NOW)).toBe("taken");
  });

  it("is freed when the shop never left the waiting list, as nobody could have seen it", async () => {
    await deleteAccountData("acc-pending");
    expect(await isSlugTaken("crochet-corner")).toBe(false);
    expect((await applyAs("acc-student", { name: "Crochet corner" }))?.slug).toBe("crochet-corner");
  });

  it("comes back to its own sample shop when the sample seller signs in again, and the newer shop keeps its own", async () => {
    await deleteAccountData("acc-seller");
    await applyAs("acc-student", { name: "Tech corner" });
    await restoreSampleAccount("seller@eduvos.com");
    expect(await restoreSampleShop("acc-seller")).toBe(true);
    expect(await getShopOf("acc-seller")).toMatchObject({ shop: { slug: "tech-corner" }, status: "approved" });
    expect(sampleStore().sellerProfiles.get("acc-seller")?.sellerSlug).toBe("tech-corner");
    expect(sampleStore().listings.get("l-001")?.sellerSlug).toBe("tech-corner");
    expect((await getShopOf("acc-student"))?.shop.slug).toBe("tech-corner-2");
    expect(await isSlugTaken("tech-corner")).toBe(true);
  });

  it("brings the waiting sample shop back under the next free link when its old one has gone to a new shop", async () => {
    await deleteAccountData("acc-pending");
    await applyAs("acc-student", { name: "Crochet corner" });
    await restoreSampleAccount("pending@eduvos.com");
    expect(await restoreSampleShop("acc-pending")).toBe(true);
    expect(await getShopOf("acc-pending")).toMatchObject({
      shop: { slug: "crochet-corner-2", name: "Crochet corner" },
      status: "pending",
    });
    expect((await getShopOf("acc-student"))?.shop.slug).toBe("crochet-corner");
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

  it("refuses a seller profile with no shop behind it", async () => {
    sampleStore().sellerProfiles.set("acc-student", {
      accountId: "acc-student",
      status: "approved",
      sellerSlug: "gone",
      appliedAt: NOW.toISOString(),
    });
    expect(await setShopPaused("acc-student", true)).toBeNull();
    expect(sampleStore().sellerProfiles.get("acc-student")?.status).toBe("approved");
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

  it("puts a sample shop and its sample listings back, once", async () => {
    await forgetShopOf("acc-seller");
    expect(await restoreSampleShop("acc-seller")).toBe(true);
    expect(sampleStore().sellers.get("tech-corner")?.ownerId).toBe("acc-seller");
    expect(sampleStore().listings.has("l-001")).toBe(true);
    expect(await restoreSampleShop("acc-seller")).toBe(false);
    expect(await restoreSampleShop("acc-student")).toBe(false);
  });
});

describe("the data export (plan decision 22)", () => {
  it("gives the shop and its listings, with pickup points by name and photos by address, and no ids", async () => {
    const data = await exportShop("acc-seller");
    expect(data.shop).toMatchObject({
      name: "Tech corner",
      link: "tech-corner",
      status: "approved",
      category: "Tech",
      campus: "midrand",
      photo: "/placeholders/seller/tech-corner.svg",
      pickupPoints: ["Library entrance", "Main reception"],
      since: "2026-03",
    });
    expect(data.listings.map((row) => row.title)).toEqual(["Casio fx-991ZA Plus calculator", "Gaming headset, barely used"]);
    expect(data.listings[0]).toMatchObject({
      state: "available",
      category: "Tech",
      pickupPoint: "Library entrance",
      photos: [
        { address: "/placeholders/listing/tech.svg", description: "" },
        { address: "/placeholders/photo/2.svg", description: "The back of the calculator, with the battery cover" },
        { address: "/placeholders/photo/3.svg", description: "The slide-on cover" },
      ],
    });
    expect(JSON.stringify(data)).not.toMatch(/acc-seller|l-001|pp-midrand/);
    expect(await exportShop("acc-student")).toEqual({ shop: null, listings: [] });
  });
});
