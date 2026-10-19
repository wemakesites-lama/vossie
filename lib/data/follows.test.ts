import { beforeEach, describe, expect, it } from "vitest";
import { listedListings } from "./catalog";
import {
  addFollow,
  countFollowers,
  exportFollowing,
  forgetFollowsOf,
  isFollowing,
  listFollowedShops,
  notifyFollowers,
  removeFollow,
} from "./follows";
import { getNotifications, notifyNewListing } from "./notifications";
import { resetSampleStore, sampleStore } from "./store";

const at = (hour: number) => new Date(`2026-10-14T${String(hour).padStart(2, "0")}:00:00.000Z`);

beforeEach(() => {
  resetSampleStore();
});

describe("following a shop (community actions spec 2.15)", () => {
  it("follows and unfollows a shop with a storefront", async () => {
    expect(await addFollow("acc-student", "tech-corner", at(8))).toBe("followed");
    expect(await isFollowing("acc-student", "tech-corner")).toBe(true);
    expect(await addFollow("acc-student", "tech-corner", at(9))).toBe("already");
    expect(sampleStore().follows.size).toBe(1);
    expect(await removeFollow("acc-student", "tech-corner")).toBe(true);
    expect(await removeFollow("acc-student", "tech-corner")).toBe(false);
    expect(await isFollowing("acc-student", "tech-corner")).toBe(false);
  });

  it("refuses the account's own shop, a shop with no storefront, and a 201st", async () => {
    expect(await addFollow("acc-seller", "tech-corner", at(8))).toBe("own");
    expect(await addFollow("acc-student", "crochet-corner", at(8))).toBe("not-found");
    expect(await addFollow("acc-student", "nope", at(8))).toBe("not-found");
    for (let n = 0; n < 200; n += 1) {
      sampleStore().follows.set(`follow-${n}`, {
        id: `follow-${n}`,
        accountId: "acc-student",
        sellerSlug: `shop-${n}`,
        createdAt: at(7).toISOString(),
      });
    }
    expect(await addFollow("acc-student", "tech-corner", at(8))).toBe("limit");
  });
});

describe("the shops you follow, and your followers (spec 2.17 and 2.18)", () => {
  it("lists them newest first, with their photo, campus, whether they're paused and how many are listed", async () => {
    await addFollow("acc-student", "code-coach", at(8));
    await addFollow("acc-student", "tech-corner", at(9));
    const codeCoachListed = listedListings().filter((listing) => listing.sellerSlug === "code-coach").length;
    expect(await listFollowedShops("acc-student")).toMatchObject([
      { slug: "tech-corner", name: "Tech corner", campusSlug: "midrand", paused: false, listed: 2 },
      { slug: "code-coach", name: "Code coach", campusSlug: "pretoria", paused: false, listed: codeCoachListed },
    ]);
    sampleStore().sellerProfiles.get("acc-seller")!.status = "paused";
    expect((await listFollowedShops("acc-student"))[0]).toMatchObject({ slug: "tech-corner", paused: true, listed: 0 });
  });

  it("counts a shop's followers, never saying who", async () => {
    await addFollow("acc-student", "tech-corner", at(8));
    await addFollow("acc-mentor", "tech-corner", at(9));
    await addFollow("acc-mentor", "code-coach", at(9));
    expect(await countFollowers("tech-corner")).toBe(2);
    expect(await countFollowers("lash-lounge")).toBe(0);
  });

  it("tells each follower about a new listing, and says how many it told (spec 2.19)", async () => {
    await addFollow("acc-student", "tech-corner", at(8));
    await addFollow("acc-mentor", "tech-corner", at(8));
    const told = await notifyFollowers({
      sellerSlug: "tech-corner",
      shopName: "Tech corner",
      listing: { id: "l-new", title: "USB-C charger" },
      now: at(10),
    });
    expect(told).toBe(2);
    expect((await getNotifications("acc-mentor", 1))[0]).toMatchObject({
      kind: "new-listing",
      text: "Tech corner listed USB-C charger",
    });
    expect((await getNotifications("acc-seller", 50)).some((item) => item.kind === "new-listing")).toBe(false);
  });
});

describe("deleting an account, and its data export (spec 2.23, plan decision 21)", () => {
  it("forgets its follows, its shop's followers and their notes about its shop", async () => {
    await addFollow("acc-seller", "code-coach", at(8));
    await addFollow("acc-student", "tech-corner", at(8));
    await addFollow("acc-student", "code-coach", at(8));
    await notifyNewListing({
      accountId: "acc-student",
      sellerSlug: "tech-corner",
      shopName: "Tech corner",
      listing: { id: "l-001", title: "Casio fx-991ZA Plus calculator" },
      now: at(9),
    });
    await forgetFollowsOf("acc-seller");
    expect([...sampleStore().follows.values()].map((row) => [row.accountId, row.sellerSlug])).toEqual([
      ["acc-student", "code-coach"],
    ]);
    expect((await getNotifications("acc-student", 50)).some((item) => item.kind === "new-listing")).toBe(false);
  });

  it("exports the shops' names, newest first, with no ids", async () => {
    await addFollow("acc-student", "code-coach", at(8));
    await addFollow("acc-student", "tech-corner", at(9));
    expect(await exportFollowing("acc-student")).toEqual(["Tech corner", "Code coach"]);
    expect(await exportFollowing("acc-mentor")).toEqual([]);
  });
});
