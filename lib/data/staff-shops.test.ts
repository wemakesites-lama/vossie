import { beforeEach, describe, expect, it } from "vitest";
import { listedListings, publicListing, shopStatus, storefrontRow } from "./catalog";
import { setShopPaused } from "./shops";
import {
  approveShop,
  countWaitingShops,
  declineShop,
  getShopForReview,
  hideListing,
  listHiddenListings,
  listMentors,
  listShopsForReview,
  resendForApproval,
  setShopMentor,
  setVerified,
  shopStanding,
  showListing,
  staffPauseShop,
  staffResumeShop,
} from "./staff-shops";
import { resetSampleStore, sampleStore } from "./store";

const NOW = new Date("2026-10-14T08:42:00.000Z");
const LATER = new Date("2026-10-15T09:00:00.000Z");

/** A second student's shop, sent for approval at `appliedAt` (the store as F's createShop leaves it). */
function waitingShop(accountId: string, slug: string, name: string, appliedAt: string) {
  const store = sampleStore();
  store.accounts.set(accountId, {
    id: accountId,
    email: `${accountId}@eduvos.com`,
    firstName: "Zola",
    campusSlug: "midrand",
    roles: [],
    createdAt: appliedAt,
  });
  store.sellers.set(slug, {
    ...structuredClone(store.sellers.get("crochet-corner")!),
    slug,
    name,
    ownerId: accountId,
    campusSlug: "midrand",
    pickupPointIds: ["pp-midrand-library"],
    createdAt: appliedAt,
    updatedAt: appliedAt,
  });
  store.sellerProfiles.set(accountId, { accountId, status: "pending", sellerSlug: null, appliedAt });
}

beforeEach(() => {
  resetSampleStore();
});

describe("the Sellers list and a shop's review (staff tools spec 2.3)", () => {
  it("puts shops waiting for approval first, oldest first, then declined ones, then the rest by name", async () => {
    waitingShop("acc-zola", "zolas-bakes", "Zola's bakes", "2026-10-12T08:00:00.000Z");
    waitingShop("acc-ama", "ama-prints", "Ama prints", "2026-10-13T08:00:00.000Z");
    await declineShop("ama-prints", "Add a photo of your work.", NOW);
    const rows = await listShopsForReview();
    expect(rows.slice(0, 3).map((row) => [row.shop.slug, row.standing])).toEqual([
      ["crochet-corner", "waiting"],
      ["zolas-bakes", "waiting"],
      ["ama-prints", "declined"],
    ]);
    expect(rows).toHaveLength(32);
    const rest = rows.slice(3).map((row) => row.shop.name);
    expect(rest).toEqual([...rest].sort((a, b) => a.localeCompare(b)));
    expect(await countWaitingShops()).toBe(2);
  });

  it("reviews a shop with its owner's first name, its standing, its mentor and what it has listed", async () => {
    expect(await getShopForReview("tech-corner")).toMatchObject({
      shop: { slug: "tech-corner", name: "Tech corner" },
      owner: { id: "acc-seller", firstName: "Sipho" },
      standing: "open",
      appliedAt: "2026-03-02T09:40:00.000Z",
      mentor: { id: "acc-mentor", firstName: "Naledi" },
      listedCount: 2,
    });
    expect(await getShopForReview("hair-studio")).toMatchObject({ owner: null, standing: "open", appliedAt: null });
    expect(await getShopForReview("nope")).toBeNull();
  });

  it("hands out copies", async () => {
    const review = (await getShopForReview("tech-corner"))!;
    review.shop.name = "Changed";
    expect(sampleStore().sellers.get("tech-corner")?.name).toBe("Tech corner");
  });
});

describe("approving and declining (staff tools spec 2.3, plan decision 2)", () => {
  it("approves a waiting shop: its storefront opens under its link", async () => {
    expect(await approveShop("crochet-corner")).toEqual({
      slug: "crochet-corner",
      name: "Crochet corner",
      ownerId: "acc-pending",
    });
    expect(sampleStore().sellerProfiles.get("acc-pending")).toMatchObject({ status: "approved", sellerSlug: "crochet-corner" });
    expect(shopStatus(sampleStore().sellers.get("crochet-corner")!)).toBe("approved");
    // A second press, or an open shop, changes nothing (plan decision 23).
    expect(await approveShop("crochet-corner")).toBeNull();
    expect(await approveShop("tech-corner")).toBeNull();
    expect(await approveShop("hair-studio")).toBeNull();
  });

  it("declines a waiting shop with its reason: it stays waiting, and can be sent again", async () => {
    expect(await declineShop("crochet-corner", "Add a photo of your work.", NOW)).toMatchObject({ ownerId: "acc-pending" });
    expect(sampleStore().sellerProfiles.get("acc-pending")).toMatchObject({
      status: "pending",
      sellerSlug: null,
      declinedAt: NOW.toISOString(),
      staffReason: "Add a photo of your work.",
    });
    expect(await shopStanding("acc-pending")).toEqual({
      declinedAt: NOW.toISOString(),
      pausedByHub: false,
      reason: "Add a photo of your work.",
    });
    // Declined isn't waiting: it can't be approved or declined again until it's sent again.
    expect(await declineShop("crochet-corner", "Again.", NOW)).toBeNull();
    expect(await approveShop("crochet-corner")).toBeNull();
    expect(await resendForApproval("acc-pending", LATER)).toBe(true);
    expect(sampleStore().sellerProfiles.get("acc-pending")).toMatchObject({
      declinedAt: null,
      staffReason: null,
      appliedAt: LATER.toISOString(),
    });
    expect(await resendForApproval("acc-pending", LATER)).toBe(false);
    expect(await approveShop("crochet-corner")).not.toBeNull();
    expect(await shopStanding("acc-student")).toBeNull();
  });

  it("decides once when two presses arrive together (plan decision 23, amendment 19)", async () => {
    const approvals = await Promise.all([approveShop("crochet-corner"), approveShop("crochet-corner")]);
    expect(approvals.filter(Boolean)).toHaveLength(1);
    waitingShop("acc-zola", "zolas-bakes", "Zola's bakes", "2026-10-12T08:00:00.000Z");
    const both = await Promise.all([approveShop("zolas-bakes"), declineShop("zolas-bakes", "No photo.", NOW)]);
    expect(both.filter(Boolean)).toHaveLength(1);
    expect(sampleStore().sellerProfiles.get("acc-zola")).toMatchObject({ status: "approved", declinedAt: null });
    waitingShop("acc-ama", "ama-prints", "Ama prints", "2026-10-13T08:00:00.000Z");
    await declineShop("ama-prints", "No photo.", NOW);
    expect(await Promise.all([resendForApproval("acc-ama", LATER), resendForApproval("acc-ama", LATER)])).toEqual([
      true,
      false,
    ]);
  });
});

describe("Verified, the Hub's pause and mentors (staff tools spec 2.3 and 2.6, plan decisions 3 and 15)", () => {
  it("gives and takes Verified on a shop with a storefront, sample shops included", async () => {
    expect(await setVerified("tech-corner", true)).toEqual({ slug: "tech-corner", name: "Tech corner", ownerId: "acc-seller" });
    expect(sampleStore().sellers.get("tech-corner")?.verified).toBe(true);
    expect(await setVerified("tech-corner", true)).toBeNull();
    expect(await setVerified("hair-studio", false)).toMatchObject({ ownerId: null });
    expect(await setVerified("crochet-corner", true)).toBeNull();
    expect(await setVerified("nope", true)).toBeNull();
    const twice = await Promise.all([setVerified("hair-studio", true), setVerified("hair-studio", true)]);
    expect(twice.filter(Boolean)).toHaveLength(1);
  });

  it("pauses an open shop with a reason, takes over a seller's own pause, and only resumes its own", async () => {
    const profile = sampleStore().sellerProfiles.get("acc-seller")!;
    expect(await staffPauseShop("tech-corner", "Selling exam answers.")).toMatchObject({ ownerId: "acc-seller" });
    expect(profile).toMatchObject({ status: "paused", pausedBy: "staff", staffReason: "Selling exam answers." });
    expect((await shopStanding("acc-seller"))?.pausedByHub).toBe(true);
    expect(await staffPauseShop("tech-corner", "Again.")).toBeNull();
    expect(await staffResumeShop("tech-corner")).toEqual({
      slug: "tech-corner",
      name: "Tech corner",
      ownerId: "acc-seller",
      sellerPauseBack: false,
    });
    expect(profile).toMatchObject({ status: "approved", pausedBy: null, staffReason: null });
    expect(await staffResumeShop("tech-corner")).toBeNull();

    Object.assign(profile, { status: "paused", pausedBy: "seller" });
    expect(await staffResumeShop("tech-corner")).toBeNull();
    expect(await staffPauseShop("tech-corner", "Reported twice.")).not.toBeNull();
    expect(profile.pausedBy).toBe("staff");
  });

  it("gives the seller's own pause back when it lifts a pause that took it over (amendments 29 and 33)", async () => {
    const profile = sampleStore().sellerProfiles.get("acc-seller")!;
    expect(await setShopPaused("acc-seller", true)).toBe("paused");
    await staffPauseShop("tech-corner", "Reported twice.");
    // The seller can't resume while the Hub's pause stands.
    expect(await setShopPaused("acc-seller", false)).toBeNull();
    expect(await staffResumeShop("tech-corner")).toMatchObject({ sellerPauseBack: true });
    expect(profile).toMatchObject({ status: "paused", pausedBy: "seller", staffReason: null, sellerPauseHeld: null });
    expect((await shopStanding("acc-seller"))?.pausedByHub).toBe(false);
    // It's the seller's again: the Hub can't resume it, and the seller can.
    expect(await staffResumeShop("tech-corner")).toBeNull();
    expect(await setShopPaused("acc-seller", false)).toBe("approved");
    // A seller's pause from before stage G has no pausedBy: it's theirs all the same.
    Object.assign(profile, { status: "paused", pausedBy: undefined });
    await staffPauseShop("tech-corner", "Reported again.");
    expect((await staffResumeShop("tech-corner"))?.sellerPauseBack).toBe(true);
  });

  it("takes the storefront and its listings' pages down while the Hub's pause lasts (amendment 15)", async () => {
    await staffPauseShop("tech-corner", "Asking for deposits.");
    expect(storefrontRow("tech-corner")).toBeNull();
    expect(publicListing("l-001")).toBeNull();
    await staffResumeShop("tech-corner");
    expect(storefrontRow("tech-corner")).not.toBeNull();
    expect(publicListing("l-001")).not.toBeNull();
  });

  it("pauses and resumes once when two presses arrive together (amendment 19)", async () => {
    const pauses = await Promise.all([staffPauseShop("tech-corner", "One."), staffPauseShop("tech-corner", "Two.")]);
    expect(pauses.filter(Boolean)).toHaveLength(1);
    expect(sampleStore().sellerProfiles.get("acc-seller")?.staffReason).toBe("One.");
    const resumes = await Promise.all([staffResumeShop("tech-corner"), staffResumeShop("tech-corner")]);
    expect(resumes.filter(Boolean)).toHaveLength(1);
    // The seller's own pause and the Hub's at once: whichever comes second finds nothing it can do, or takes over.
    const [own, hub] = await Promise.all([setShopPaused("acc-seller", true), staffPauseShop("tech-corner", "Three.")]);
    expect(own).toBe("paused");
    expect(hub).not.toBeNull();
    expect(sampleStore().sellerProfiles.get("acc-seller")).toMatchObject({ pausedBy: "staff", sellerPauseHeld: true });
  });

  it("can't pause a waiting shop, or a sample shop no account owns", async () => {
    expect(await staffPauseShop("crochet-corner", "No.")).toBeNull();
    expect(await staffPauseShop("hair-studio", "No.")).toBeNull();
    expect(await staffResumeShop("hair-studio")).toBeNull();
  });

  it("assigns a mentor from the accounts with the mentor role, or none", async () => {
    expect(await listMentors()).toEqual([{ id: "acc-mentor", firstName: "Naledi" }]);
    expect(await setShopMentor("tech-corner", "acc-mentor")).toBeNull();
    expect(await setShopMentor("tech-corner", null)).toMatchObject({ ownerId: "acc-seller", mentorName: null });
    expect(sampleStore().sellerProfiles.get("acc-seller")?.mentorId).toBeNull();
    expect(await setShopMentor("tech-corner", "acc-student")).toBeNull();
    expect(await setShopMentor("tech-corner", "acc-mentor")).toMatchObject({ mentorName: "Naledi" });
    expect(await setShopMentor("hair-studio", "acc-mentor")).toBeNull();
    expect(await setShopMentor("crochet-corner", "acc-mentor")).toBeNull();
    const twice = await Promise.all([setShopMentor("tech-corner", null), setShopMentor("tech-corner", null)]);
    expect(twice.filter(Boolean)).toHaveLength(1);
  });
});

describe("hiding a listing (staff tools spec 2.3, plan decision 4)", () => {
  it("keeps the row with its reason, takes it out of every list and gives it no page", async () => {
    expect(await hideListing("l-001", "Not allowed on Vossie.", NOW)).toEqual({
      id: "l-001",
      title: "Casio fx-991ZA Plus calculator",
      sellerSlug: "tech-corner",
      state: "available",
      ownerId: "acc-seller",
    });
    expect(sampleStore().listings.get("l-001")).toMatchObject({
      hiddenReason: "Not allowed on Vossie.",
      hiddenAt: NOW.toISOString(),
    });
    expect(listedListings().some((listing) => listing.id === "l-001")).toBe(false);
    expect(publicListing("l-001")).toBeNull();
    expect(await hideListing("l-001", "Again.", NOW)).toBeNull();
    expect(await hideListing("l-nope", "No.", NOW)).toBeNull();
    expect(await hideListing("l-004", "A sample shop's.", NOW)).toMatchObject({ ownerId: null });
  });

  it("lists a shop's hidden listings for its review page, newest hidden first (amendment 18)", async () => {
    await hideListing("l-001", "Not allowed on Vossie.", NOW);
    await hideListing("l-007", "Counterfeit.", LATER);
    expect(await listHiddenListings("tech-corner")).toEqual([
      { id: "l-007", title: "Gaming headset, barely used", hiddenAt: LATER.toISOString(), reason: "Counterfeit." },
      { id: "l-001", title: "Casio fx-991ZA Plus calculator", hiddenAt: NOW.toISOString(), reason: "Not allowed on Vossie." },
    ]);
    expect(await listHiddenListings("hair-studio")).toEqual([]);
  });

  it("shows a hidden listing again: the hidden fields go, and it's back where it was (amendment 18)", async () => {
    await hideListing("l-001", "Not allowed on Vossie.", NOW);
    expect(await showListing("l-001")).toEqual({
      id: "l-001",
      title: "Casio fx-991ZA Plus calculator",
      sellerSlug: "tech-corner",
      state: "available",
      ownerId: "acc-seller",
    });
    expect(sampleStore().listings.get("l-001")).toMatchObject({ hiddenAt: null, hiddenReason: null });
    expect(publicListing("l-001")).not.toBeNull();
    expect(listedListings().some((listing) => listing.id === "l-001")).toBe(true);
    expect(await showListing("l-001")).toBeNull();
    expect(await showListing("l-nope")).toBeNull();
  });

  it("hides and shows once when two presses arrive together (amendment 19)", async () => {
    const hides = await Promise.all([hideListing("l-001", "One.", NOW), hideListing("l-001", "Two.", NOW)]);
    expect(hides.filter(Boolean)).toHaveLength(1);
    expect(sampleStore().listings.get("l-001")?.hiddenReason).toBe("One.");
    const shows = await Promise.all([showListing("l-001"), showListing("l-001")]);
    expect(shows.filter(Boolean)).toHaveLength(1);
  });
});
