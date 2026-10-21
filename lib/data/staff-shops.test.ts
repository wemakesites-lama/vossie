import { beforeEach, describe, expect, it } from "vitest";
import { listedListings, publicListing, shopStatus } from "./catalog";
import { createRequest } from "./requests";
import {
  approveShop,
  declineShop,
  getShopForReview,
  hideListing,
  isOwnListing,
  isOwnRequest,
  isOwnShop,
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
    await declineShop("ama-prints", "acc-ama", "Add a photo of your work.", NOW);
    const rows = await listShopsForReview();
    expect(rows.slice(0, 3).map((row) => [row.shop.slug, row.standing])).toEqual([
      ["crochet-corner", "waiting"],
      ["zolas-bakes", "waiting"],
      ["ama-prints", "declined"],
    ]);
    expect(rows).toHaveLength(32);
    const rest = rows.slice(3).map((row) => row.shop.name);
    expect(rest).toEqual([...rest].sort((a, b) => a.localeCompare(b)));
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
});

describe("approving and declining (staff tools spec 2.3, plan decision 2)", () => {
  it("records when a shop was first approved, not declined, and keeps it through a pause (stage J spec section 4)", async () => {
    // A decline records no approval.
    await declineShop("crochet-corner", "acc-pending", "Add a photo of your work.", NOW);
    expect(sampleStore().sellerProfiles.get("acc-pending")?.approvedAt).toBeUndefined();
    await resendForApproval("acc-pending", NOW);
    await approveShop("crochet-corner", "acc-pending", LATER);
    expect(sampleStore().sellerProfiles.get("acc-pending")?.approvedAt).toBe(LATER.toISOString());
    // The Hub's pause and resume don't approve it again.
    await staffPauseShop("crochet-corner", "Checking it.");
    await staffResumeShop("crochet-corner");
    expect(sampleStore().sellerProfiles.get("acc-pending")).toMatchObject({
      status: "approved",
      approvedAt: LATER.toISOString(),
    });
  });

  it("seeds Sipho's open shop with its start as its approval, and Lerato's waiting one with none (stage J plan decision 4)", () => {
    expect(sampleStore().sellerProfiles.get("acc-seller")?.approvedAt).toBe("2026-03-01T08:00:00.000Z");
    expect(sampleStore().sellers.get("tech-corner")?.createdAt).toBe("2026-03-01T08:00:00.000Z");
    expect(sampleStore().sellerProfiles.get("acc-pending")?.approvedAt).toBeUndefined();
  });

  it("approves a waiting shop: its storefront opens under its link", async () => {
    expect(await approveShop("crochet-corner", "acc-pending", NOW)).toEqual({
      slug: "crochet-corner",
      name: "Crochet corner",
      ownerId: "acc-pending",
    });
    expect(sampleStore().sellerProfiles.get("acc-pending")).toMatchObject({ status: "approved", sellerSlug: "crochet-corner" });
    expect(shopStatus(sampleStore().sellers.get("crochet-corner")!)).toBe("approved");
    // A second press, or an open shop, changes nothing (plan decision 23).
    expect(await approveShop("crochet-corner", "acc-pending", NOW)).toBeNull();
    expect(await approveShop("tech-corner", "acc-seller", NOW)).toBeNull();
    expect(await approveShop("hair-studio", "acc-seller", NOW)).toBeNull();
  });

  it("declines a waiting shop with its reason: it stays waiting, and can be sent again", async () => {
    expect(await declineShop("crochet-corner", "acc-pending", "Add a photo of your work.", NOW)).toMatchObject({ ownerId: "acc-pending" });
    expect(sampleStore().sellerProfiles.get("acc-pending")).toMatchObject({
      status: "pending",
      sellerSlug: null,
      declinedAt: NOW.toISOString(),
      staffReason: "Add a photo of your work.",
    });
    // appliedAt is the profile's own (amendment 6: /sell shows when the shop was sent, or sent again).
    expect(await shopStanding("acc-pending")).toEqual({
      declinedAt: NOW.toISOString(),
      pausedByHub: false,
      reason: "Add a photo of your work.",
      appliedAt: "2026-10-10T12:20:00.000Z",
    });
    // Declined isn't waiting: it can't be approved or declined again until it's sent again.
    expect(await declineShop("crochet-corner", "acc-pending", "Again.", NOW)).toBeNull();
    expect(await approveShop("crochet-corner", "acc-pending", NOW)).toBeNull();
    expect(await resendForApproval("acc-pending", LATER)).toBe(true);
    expect(sampleStore().sellerProfiles.get("acc-pending")).toMatchObject({
      declinedAt: null,
      staffReason: null,
      appliedAt: LATER.toISOString(),
    });
    expect((await shopStanding("acc-pending"))?.appliedAt).toBe(LATER.toISOString());
    expect(await resendForApproval("acc-pending", LATER)).toBe(false);
    expect(await approveShop("crochet-corner", "acc-pending", NOW)).not.toBeNull();
  });

  it("acts only on the shop that was reviewed: another owner on the link changes nothing (amendment 14.6)", async () => {
    expect(await approveShop("crochet-corner", "acc-student", NOW)).toBeNull();
    expect(await approveShop("crochet-corner", "", NOW)).toBeNull();
    expect(await declineShop("crochet-corner", "acc-student", "No.", NOW)).toBeNull();
    expect(sampleStore().sellerProfiles.get("acc-pending")).toMatchObject({ status: "pending", sellerSlug: null });
    expect(sampleStore().sellerProfiles.get("acc-pending")?.declinedAt ?? null).toBeNull();
    // The shop's own owner still works.
    expect(await declineShop("crochet-corner", "acc-pending", "Add a photo of your work.", NOW)).not.toBeNull();
  });
});

describe("Verified, the Hub's pause and mentors (staff tools spec 2.3 and 2.6, plan decisions 3 and 15)", () => {
  it("gives and takes Verified on a shop with a storefront, sample shops included", async () => {
    expect(await setVerified("tech-corner", true)).toEqual({ slug: "tech-corner", name: "Tech corner", ownerId: "acc-seller" });
    expect(sampleStore().sellers.get("tech-corner")?.verified).toBe(true);
    expect(await setVerified("tech-corner", true)).toBeNull();
    expect(await setVerified("hair-studio", false)).toMatchObject({ ownerId: null });
    expect(await setVerified("crochet-corner", true)).toBeNull();
  });

  it("pauses an open shop with a reason, takes over a seller's own pause, and only resumes its own", async () => {
    const profile = sampleStore().sellerProfiles.get("acc-seller")!;
    expect(await staffPauseShop("tech-corner", "Selling exam answers.")).toMatchObject({ ownerId: "acc-seller" });
    expect(profile).toMatchObject({ status: "paused", pausedBy: "staff", staffReason: "Selling exam answers." });
    expect((await shopStanding("acc-seller"))?.pausedByHub).toBe(true);
    expect(await staffPauseShop("tech-corner", "Again.")).toBeNull();
    expect(await staffResumeShop("tech-corner")).toMatchObject({ ownerId: "acc-seller", stillPausedBySeller: false });
    expect(profile).toMatchObject({ status: "approved", pausedBy: null, staffReason: null });
    expect(await staffResumeShop("tech-corner")).toBeNull();

    Object.assign(profile, { status: "paused", pausedBy: "seller" });
    expect(await staffResumeShop("tech-corner")).toBeNull();
    expect(await staffPauseShop("tech-corner", "Reported twice.")).not.toBeNull();
    expect(profile.pausedBy).toBe("staff");
  });

  it("remembers a seller's own pause under the Hub's, and puts it back on Resume (amendment 13.3)", async () => {
    const profile = sampleStore().sellerProfiles.get("acc-seller")!;
    Object.assign(profile, { status: "paused", pausedBy: "seller" });
    await staffPauseShop("tech-corner", "Reported twice.");
    expect(profile).toMatchObject({ status: "paused", pausedBy: "staff", sellerPausedToo: true });
    expect(await staffResumeShop("tech-corner")).toMatchObject({ stillPausedBySeller: true });
    expect(profile).toMatchObject({ status: "paused", pausedBy: "seller", staffReason: null, sellerPausedToo: false });
    // The seller's own pause is theirs to end again.
    expect(await staffResumeShop("tech-corner")).toBeNull();
  });

  it("can't pause a waiting shop, or a sample shop no account owns", async () => {
    expect(await staffPauseShop("crochet-corner", "No.")).toBeNull();
    expect(await staffPauseShop("hair-studio", "No.")).toBeNull();
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
  });

  it("won't make a shop's owner its mentor: nobody reads notes about their own shop (amendment 15.3)", async () => {
    sampleStore().accounts.get("acc-seller")!.roles.push("mentor");
    expect(await listMentors()).toContainEqual({ id: "acc-seller", firstName: "Sipho" });
    expect(await setShopMentor("tech-corner", "acc-seller")).toBeNull();
    // The mentor it had stays.
    expect(sampleStore().sellerProfiles.get("acc-seller")?.mentorId).toBe("acc-mentor");
    // Another shop can still have them.
    sampleStore().sellerProfiles.get("acc-pending")!.status = "approved";
    expect(await setShopMentor("crochet-corner", "acc-seller")).toMatchObject({ mentorName: "Sipho" });
  });
});

describe("hiding a listing (staff tools spec 2.3, plan decision 4)", () => {
  it("keeps the row with its reason, takes it out of every list and gives it no page", async () => {
    expect(await hideListing("l-001", "Not allowed on CampusCart.", NOW)).toEqual({
      id: "l-001",
      title: "Casio fx-991ZA Plus calculator",
      sellerSlug: "tech-corner",
      state: "available",
      ownerId: "acc-seller",
    });
    expect(sampleStore().listings.get("l-001")).toMatchObject({
      hiddenReason: "Not allowed on CampusCart.",
      hiddenAt: NOW.toISOString(),
    });
    expect(listedListings().some((listing) => listing.id === "l-001")).toBe(false);
    expect(publicListing("l-001")).toBeNull();
    expect(await hideListing("l-001", "Again.", NOW)).toBeNull();
    expect(await hideListing("l-nope", "No.", NOW)).toBeNull();
    expect(await hideListing("l-004", "A sample shop's.", NOW)).toMatchObject({ ownerId: null });
  });
});

describe("Show again (stage J spec decision 14)", () => {
  it("clears a listing's hide and keeps its own state; null when it isn't hidden or has gone", async () => {
    sampleStore().listings.get("l-001")!.state = "sold";
    await hideListing("l-001", "Checking it.", NOW);
    expect(await showListing("l-001")).toEqual({
      id: "l-001",
      title: "Casio fx-991ZA Plus calculator",
      state: "sold",
      ownerId: "acc-seller",
    });
    expect(sampleStore().listings.get("l-001")).toMatchObject({ hiddenAt: null, hiddenReason: null, state: "sold" });
    expect(await showListing("l-001")).toBeNull();
    expect(await showListing("l-nope")).toBeNull();
  });
});

describe("whose it is (stage L spec decision 2)", () => {
  it("knows a shop's owner now, a waiting shop's too; a sample shop no account owns is nobody's", () => {
    expect(isOwnShop("acc-seller", "tech-corner")).toBe(true);
    expect(isOwnShop("acc-admin", "tech-corner")).toBe(false);
    expect(isOwnShop("acc-pending", "crochet-corner")).toBe(true);
    expect(isOwnShop("acc-admin", "hair-studio")).toBe(false);
    expect(isOwnShop("acc-seller", "no-such-shop")).toBe(false);
  });

  it("reads the store when it's asked, never a form: a shop that changes hands changes owner", () => {
    sampleStore().sellers.get("tech-corner")!.ownerId = "acc-student";
    expect(isOwnShop("acc-seller", "tech-corner")).toBe(false);
    expect(isOwnShop("acc-student", "tech-corner")).toBe(true);
  });

  it("knows a listing by its shop's owner", () => {
    expect(isOwnListing("acc-seller", "l-001")).toBe(true);
    expect(isOwnListing("acc-admin", "l-001")).toBe(false);
    expect(isOwnListing("acc-seller", "l-nope")).toBe(false);
  });

  it("knows a request by its asker; a sample request has none, so it's nobody's", async () => {
    const { id } = await createRequest({
      askerId: "acc-seller",
      fields: {
        title: "Desk lamp for res",
        categorySlug: "res-living",
        campusSlug: "midrand",
        details: "A lamp that clips onto a desk, by the weekend.",
        budgetZar: 150,
        swapWelcome: false,
        neededBy: null,
      },
      now: NOW,
    });
    expect(isOwnRequest("acc-seller", id)).toBe(true);
    expect(isOwnRequest("acc-admin", id)).toBe(false);
    expect(isOwnRequest("acc-seller", "r-001")).toBe(false);
    expect(isOwnRequest("acc-seller", "r-nope")).toBe(false);
  });
});

describe("the mentor choice leaves out the shop's owner (stage L spec decision 5)", () => {
  it("lists every mentor but the owner it's told to leave out", async () => {
    sampleStore().accounts.get("acc-seller")!.roles.push("mentor");
    expect(await listMentors("acc-seller")).toEqual([{ id: "acc-mentor", firstName: "Naledi" }]);
    expect(await listMentors(null)).toContainEqual({ id: "acc-seller", firstName: "Sipho" });
    expect(await listMentors()).toContainEqual({ id: "acc-seller", firstName: "Sipho" });
  });
});
