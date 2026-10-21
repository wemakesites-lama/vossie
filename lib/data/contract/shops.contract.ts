import { afterEach, beforeEach, expect, it } from "vitest";
import { getPickupPoints } from "@/lib/data";
import { getOwnListing, saveOwnListing } from "@/lib/data/own-listings";
import { photoFor, photoIdOf, storePhotos, type Upload } from "@/lib/data/photos";
import {
  changeShopSlug,
  createShop,
  emptyDraft,
  exportShop,
  getOnboardingDraft,
  getShopOf,
  isShopNameTaken,
  isSlugTaken,
  saveOnboardingDraft,
  setShopPaused,
  updateShop,
  type ShopDetails,
} from "@/lib/data/shops";
import type { ListingFields } from "@/lib/selling/rules";
import { sastDate } from "@/lib/time";
import { pngBytes } from "@/tests/helpers/image-bytes";
import type { World, WorldAccountName } from "@/tests/contract/world";

// A seller's own shop in both backends (C2/C3 plan Task 8; selling spec 2.6 to 2.8 and 2.11; decisions 6 to 8): the
// wizard's draft, applying, the link from the name (reserved words and links kept by other shops included), the name
// and link checks, Edit shop while waiting, the one change of link, Pause and Resume, and the export. The owner is the
// "seller" account, which starts with no shop. shops.test.ts runs it on the sample store, shops.db.test.ts on the local
// stack.

const png = (): Upload => ({ type: "image/png", bytes: pngBytes() });
const nobody = async () => null;

/** The campus's pickup points in use, in their order: the sample's ids or the database's uuids. */
async function pointsAt(campus: string): Promise<string[]> {
  return (await getPickupPoints()).filter((point) => point.campusSlug === campus).map((point) => point.id);
}

export function shopsContract(makeWorld: () => World): void {
  let world: World;
  let now: Date;
  beforeEach(async () => {
    world = makeWorld();
    now = new Date();
    for (const name of ["seller", "shopper"] as const) await world.tidySelling(name);
  });
  afterEach(async () => {
    await world.cleanup();
  });

  const as = <T>(name: WorldAccountName, read: (id: string) => Promise<T>) => world.asViewer(name, read);

  async function details(over: Partial<ShopDetails> = {}): Promise<ShopDetails> {
    return {
      name: "Contract crochet corner",
      tagline: "Hats and scarves.",
      categorySlug: "fashion-thrift",
      about: "I crochet between lectures.",
      image: null,
      campusSlug: "pretoria",
      pickupPointIds: (await pointsAt("pretoria")).slice(0, 1),
      ...over,
    };
  }

  it("keeps the wizard's draft and its photo, and makes a waiting shop from it", async () => {
    expect(await as("seller", getShopOf)).toBeNull();
    const points = await pointsAt("pretoria");
    const [first] = await as("seller", (seller) => storePhotos(seller, [png()], now));
    const draft = {
      ...emptyDraft(await world.signedIn("seller"), "pretoria", now),
      name: "Contract crochet corner",
      tagline: "Hats and scarves.",
      categorySlug: "fashion-thrift",
      about: "I crochet between lectures.",
      photoSrc: first,
      pickupPointIds: points.slice(0, 1),
    };
    await as("seller", () => saveOnboardingDraft(draft));
    // The time is the backend's own (the database stamps it), so everything but it is compared.
    expect({ ...(await as("seller", getOnboardingDraft))!, updatedAt: "" }).toEqual({ ...draft, updatedAt: "" });

    const [second] = await as("seller", (seller) => storePhotos(seller, [png()], now));
    await as("seller", () => saveOnboardingDraft({ ...draft, photoSrc: second }));
    expect(await photoFor(photoIdOf(first)!, nobody, new Date())).toBeNull();
    expect((await as("seller", getOnboardingDraft))?.photoSrc).toBe(second);

    const withPhoto = { ...(await details()), image: { src: second, alt: "" } };
    const shop = await as("seller", (seller) => createShop(seller, withPhoto, now));
    expect(shop).toMatchObject({
      slug: "contract-crochet-corner",
      name: "Contract crochet corner",
      badge: "new-seller",
      verified: false,
      since: sastDate(now).slice(0, 7),
      image: { src: second, alt: "" },
      campusSlug: "pretoria",
      pickupPointIds: points.slice(0, 1),
    });
    expect(await as("seller", getShopOf)).toMatchObject({ status: "pending", pausedByHub: false, shop: { slug: shop!.slug } });
    expect(await as("seller", getOnboardingDraft)).toBeNull();
    expect(await photoFor(photoIdOf(second)!, nobody, new Date())).not.toBeNull();
    // A second application makes nothing.
    expect(await as("seller", async (seller) => createShop(seller, await details({ name: "Another" }), now))).toBeNull();
  });

  it("makes a link from the name, never a reserved word or one another shop has, on any campus", async () => {
    const shop = await as("seller", async (seller) => createShop(seller, await details({ name: "Export" }), now));
    expect(shop?.slug).toBe("export-shop");
  });

  it("numbers a link another campus's shop has", async () => {
    const theirs = await world.openShop("shopper", { name: "Contract crochet corner", campus: "midrand" });
    expect(theirs).toBe("contract-crochet-corner");
    const shop = await as("seller", async (seller) => createShop(seller, await details(), now));
    expect(shop?.slug).toBe("contract-crochet-corner-2");
  });

  it("checks a name against the campus's shops, waiting ones included, however it's written", async () => {
    const shop = (await as("seller", async (seller) => createShop(seller, await details(), now)))!;
    await as("shopper", async () => {
      expect(await isShopNameTaken("contract crochet  CORNER!", "pretoria", null)).toBe(true);
      expect(await isShopNameTaken("Contract crochet corner", "midrand", null)).toBe(false);
      expect(await isShopNameTaken("Contract crochet corner", "pretoria", shop.slug)).toBe(false);
      expect(await isShopNameTaken("Contract waiting bakes", "pretoria", null)).toBe(false);
    });
    await world.openShop("shopper", { name: "Contract waiting bakes", status: "pending" });
    expect(await as("seller", () => isShopNameTaken("Contract waiting bakes", "pretoria", null))).toBe(true);
  });

  it("counts reserved words, shops' links and links a shop has left as taken", async () => {
    const theirs = await world.openShop("shopper", { name: "Contract link keeper" });
    await as("shopper", (shopper) => changeShopSlug(shopper, "contract-link-kept", now));
    await as("seller", async () => {
      expect(await isSlugTaken("export")).toBe(true);
      expect(await isSlugTaken("contract-link-kept")).toBe(true);
      expect(await isSlugTaken(theirs)).toBe(true);
      expect(await isSlugTaken("contract-link-free")).toBe(false);
    });
  });

  it("while waiting, moves the link with the name, and the listings with the campus and its points", async () => {
    const [pretoria] = await pointsAt("pretoria");
    const midrand = await pointsAt("midrand");
    const shop = (await as("seller", async (seller) => createShop(seller, await details(), now)))!;
    const fields: ListingFields = {
      kind: "item",
      title: "Contract scarf",
      categorySlug: "fashion-thrift",
      condition: "new",
      priceZar: 120,
      priceIsFrom: false,
      payMode: "cash",
      swapFor: null,
      description: "A scarf the contract tests make.",
      handover: "pickup",
      pickupPointId: pretoria,
    };
    const seller = await world.signedIn("seller");
    const listing = (await as("seller", () =>
      saveOwnListing({ sellerSlug: shop.slug, ownerId: seller, id: null, fields, photos: [], intent: "publish", now }),
    ))!;
    expect(listing.state).toBe("draft");

    const moved = (await as("seller", async () =>
      updateShop(seller, await details({ name: "Contract knit corner", campusSlug: "midrand", pickupPointIds: midrand.slice(0, 1) }), now),
    ))!;
    expect(moved.slug).toBe("contract-knit-corner");
    // A waiting shop's link follows its name: it has no change of link to use.
    expect(await as("seller", () => changeShopSlug(seller, "contract-new-link", now))).toBeNull();
    expect(await as("seller", getShopOf)).toMatchObject({ status: "pending", shop: { slug: "contract-knit-corner" } });
    expect(await as("seller", () => getOwnListing(moved.slug, listing.id))).toMatchObject({
      campusSlug: "midrand",
      handover: "pickup",
      pickupPointId: midrand[0],
    });

    // A campus with no points in use: the pickup goes online. (Its point stays in use: a listing on a retired point
    // keeps it in the sample, amendment 13.6, which update_shop doesn't yet; see the plan's changes.)
    const points = await getPickupPoints();
    const bare = points.find((point) => !["pretoria", "midrand"].includes(point.campusSlug))!.campusSlug;
    for (const point of points.filter((p) => p.campusSlug === bare)) await world.retirePickupPoint(point.id);
    await as("seller", async () =>
      updateShop(seller, await details({ name: "Contract knit corner", campusSlug: bare, pickupPointIds: [] }), now),
    );
    expect(await as("seller", () => getOwnListing(moved.slug, listing.id))).toMatchObject({
      campusSlug: bare,
      handover: "online",
      pickupPointId: null,
    });
  });

  it("changes an approved shop's link once, keeps the old one from other shops, and exports it", async () => {
    const old = await world.openShop("seller", { name: "Contract link changer" });
    expect(await as("seller", (seller) => changeShopSlug(seller, old, now))).toBe("same");
    expect(await as("seller", (seller) => changeShopSlug(seller, "contract-new-link", now))).toBe("changed");
    expect(await as("seller", (seller) => changeShopSlug(seller, "contract-newer-link", now))).toBe("used");
    expect((await as("seller", getShopOf))?.shop).toMatchObject({ slug: "contract-new-link", slugChanged: true, previousSlugs: [old] });
    await world.openShop("shopper", { name: "Contract link wanter" });
    expect(await as("shopper", (shopper) => changeShopSlug(shopper, old, now))).toBe("taken");
    expect((await as("seller", exportShop)).shop?.previousLinks).toEqual([`/sellers/${old}`]);
  });

  it("pauses an approved shop and resumes it, but never a pause the Hub made", async () => {
    const slug = await world.openShop("seller");
    expect(await as("seller", (seller) => setShopPaused(seller, true))).toBe("paused");
    expect(await as("seller", getShopOf)).toMatchObject({ status: "paused", pausedByHub: false });
    expect(await as("seller", (seller) => setShopPaused(seller, true))).toBeNull();
    expect(await as("seller", (seller) => setShopPaused(seller, false))).toBe("approved");
    await world.pauseShop(slug, "staff");
    expect(await as("seller", (seller) => setShopPaused(seller, false))).toBeNull();
    expect(await as("seller", getShopOf)).toMatchObject({ status: "paused", pausedByHub: true });
  });

  it("exports the shop with its points by name, its photo by address, its approval, and no ids", async () => {
    const slug = await world.openShop("seller", { name: "Contract export shop" });
    const seller = await world.signedIn("seller");
    const [photo] = await as("seller", () => storePhotos(seller, [png()], now));
    const own = (await as("seller", getShopOf))!;
    await as("seller", async () =>
      updateShop(
        seller,
        {
          name: own.shop.name,
          tagline: own.shop.tagline,
          categorySlug: own.shop.categorySlug,
          about: own.shop.about,
          image: { src: photo, alt: "" },
          campusSlug: own.shop.campusSlug,
          pickupPointIds: own.shop.pickupPointIds,
        },
        now,
      ),
    );
    const pointName = (await getPickupPoints()).find((point) => point.id === own.shop.pickupPointIds[0])!.name;
    const exported = await as("seller", exportShop);
    expect(exported).toEqual({
      shop: {
        name: "Contract export shop",
        link: slug,
        previousLinks: [],
        status: "approved",
        approvedAt: expect.any(String),
        tagline: own.shop.tagline,
        category: "Tech",
        campus: "pretoria",
        about: own.shop.about,
        photo,
        pickupPoints: [pointName],
        since: own.shop.since,
        createdAt: own.shop.createdAt,
      },
      listings: [],
      onboardingDraft: null,
    });
    expect(Number.isNaN(Date.parse(exported.shop!.approvedAt!))).toBe(false);
  });
}
