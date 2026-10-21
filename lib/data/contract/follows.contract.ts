import { afterEach, beforeEach, expect, it } from "vitest";
import { categoryPicture } from "@/lib/data/catalog";
import {
  addFollow,
  countFollowers,
  exportFollowing,
  isFollowing,
  listFollowedShops,
  removeFollow,
  shopNameOf,
} from "@/lib/data/follows";
import { markNotificationsRead } from "@/lib/data/notifications";
import { newListingsText, newListingText } from "@/lib/following/rules";
import type { World } from "@/tests/contract/world";

// Following shops in both backends (C4/C5 plan Task 7; decision 10, amendment 3): Follow's answers, the follow and
// unfollow, Saved's Shops tab (a shop the Hub paused listed by name with no storefront, a waiting one not at all), a
// shop's name for a status line, the owner's count, the download, and the followers told of a first publish once a
// day (save_listing on Supabase, notifyFollowers on the sample store). The follower is "asker".
// follows.test.ts runs it on the sample store, follows.db.test.ts on the local stack.

/** A short wait, so two follows made one after the other never share a time (the sample sorts by it). */
const tick = () => new Promise((resolve) => setTimeout(resolve, 5));

export function followsContract(makeWorld: () => World): void {
  let world: World;
  let asker: string;
  beforeEach(async () => {
    world = makeWorld();
    await world.tidyCommunity();
    for (const owner of ["asker", "shopper", "seller", "staff"] as const) await world.tidySelling(owner);
    await world.tidyMessaging();
    asker = await world.signedIn("asker");
  });
  afterEach(async () => {
    await world.cleanup();
  });

  const as = <T>(read: () => Promise<T>) => world.asViewer("asker", read);

  it("follows a shop with a storefront once, and never its own, a waiting one or one the Hub paused", async () => {
    const lamps = await world.openShop("shopper", { name: "Contract lamps" });
    const waiting = await world.openShop("seller", { name: "Contract waiting", status: "pending" });
    const paused = await world.openShop("staff", { name: "Contract paused" });
    await world.pauseShop(paused, "staff");
    const own = await world.openShop("asker", { name: "Contract own" });
    expect(await as(() => addFollow(asker, lamps, new Date()))).toBe("followed");
    expect(await as(() => addFollow(asker, lamps, new Date()))).toBe("already");
    expect(await as(() => addFollow(asker, own, new Date()))).toBe("own");
    expect(await as(() => addFollow(asker, waiting, new Date()))).toBe("not-found");
    expect(await as(() => addFollow(asker, paused, new Date()))).toBe("not-found");
    expect(await as(() => addFollow(asker, "contract-no-such-shop", new Date()))).toBe("not-found");
  });

  it("stops at 200 follows", async () => {
    const lamps = await world.openShop("shopper", { name: "Contract lamps" });
    await world.fillFollows("asker", 200);
    expect(await as(() => addFollow(asker, lamps, new Date()))).toBe("limit");
    expect(await as(() => isFollowing(asker, lamps))).toBe(false);
  });

  it("unfollows once", async () => {
    const lamps = await world.openShop("shopper", { name: "Contract lamps" });
    await as(() => addFollow(asker, lamps, new Date()));
    expect(await as(() => isFollowing(asker, lamps))).toBe(true);
    expect(await as(() => removeFollow(asker, lamps))).toBe(true);
    expect(await as(() => removeFollow(asker, lamps))).toBe(false);
    expect(await as(() => isFollowing(asker, lamps))).toBe(false);
  });

  it("lists the followed shops newest first, with what each card shows, and never a waiting shop", async () => {
    const lamps = await world.openShop("shopper", { name: "Contract lamps" });
    await world.addListing(lamps, { title: "Contract desk lamp" });
    await world.addListing(lamps, { title: "Contract floor lamp" });
    await world.hideListing(await world.addListing(lamps, { title: "Contract hidden lamp" }), "Contract reason");
    const resting = await world.openShop("seller", { name: "Contract resting" });
    await world.pauseShop(resting, "seller");
    const waiting = await world.openShop("staff", { name: "Contract waiting", status: "pending" });
    await world.follow("asker", lamps);
    await tick();
    await world.follow("asker", resting);
    await tick();
    await world.follow("asker", waiting);
    expect(await as(() => listFollowedShops(asker))).toEqual([
      {
        slug: resting,
        name: "Contract resting",
        campusSlug: "pretoria",
        image: categoryPicture("tech"),
        paused: true,
        storefront: true,
        listed: 0,
      },
      {
        slug: lamps,
        name: "Contract lamps",
        campusSlug: "pretoria",
        image: categoryPicture("tech"),
        paused: false,
        storefront: true,
        listed: 2,
      },
    ]);
  });

  it("lists a shop the Hub paused by name, with no storefront, names it, and keeps it in the download", async () => {
    const lamps = await world.openShop("shopper", { name: "Contract lamps" });
    const kettles = await world.openShop("seller", { name: "Contract kettles" });
    await world.follow("asker", kettles);
    await tick();
    await world.follow("asker", lamps);
    await world.pauseShop(lamps, "staff");
    expect((await as(() => listFollowedShops(asker))).map((shop) => [shop.slug, shop.name, shop.paused, shop.storefront])).toEqual([
      [lamps, "Contract lamps", true, false],
      [kettles, "Contract kettles", false, true],
    ]);
    expect(await as(() => shopNameOf(lamps))).toBe("Contract lamps");
    expect(await as(() => shopNameOf("contract-no-such-shop"))).toBeNull();
    expect(await as(() => exportFollowing(asker))).toEqual(["Contract lamps", "Contract kettles"]);
  });

  it("names a shop with a storefront that the account doesn't follow", async () => {
    const lamps = await world.openShop("shopper", { name: "Contract lamps" });
    expect(await as(() => shopNameOf(lamps))).toBe("Contract lamps");
  });

  it("gives the owner the number who follow, never who", async () => {
    const lamps = await world.openShop("shopper", { name: "Contract lamps" });
    expect(await world.asViewer("shopper", () => countFollowers(lamps))).toBe(0);
    await world.follow("asker", lamps);
    expect(await world.asViewer("shopper", () => countFollowers(lamps))).toBe(1);
  });

  it("tells each follower of a first publish once a day: the listing, then how many, and nothing more once read", async () => {
    const lamps = await world.openShop("shopper", { name: "Contract lamps" });
    await world.follow("asker", lamps);
    const newListings = async () => (await world.notificationsOf("asker")).filter((note) => note.kind === "new-listing");
    const first = await world.publishListing("shopper", lamps, { title: "Contract desk lamp" });
    expect(await newListings()).toEqual([
      { kind: "new-listing", subjectId: lamps, text: newListingText("Contract lamps", "Contract desk lamp"), href: `/listings/${first}` },
    ]);
    await world.publishListing("shopper", lamps, { title: "Contract floor lamp" });
    expect(await newListings()).toEqual([
      { kind: "new-listing", subjectId: lamps, text: newListingsText("Contract lamps", 2), href: `/sellers/${lamps}` },
    ]);
    await as(() => markNotificationsRead(asker, new Date()));
    await world.publishListing("shopper", lamps, { title: "Contract reading lamp" });
    expect(await newListings()).toEqual([
      { kind: "new-listing", subjectId: lamps, text: newListingsText("Contract lamps", 2), href: `/sellers/${lamps}` },
    ]);
  });

  it("on Supabase, never tells the owner, even following their own shop", async () => {
    // The sample's notifyFollowers tells every follower; Follow refuses an owner ("own"), so only a row put in by hand
    // could reach it. save_listing leaves the owner out (private.tell_followers).
    if (world.name !== "supabase") return;
    const lamps = await world.openShop("shopper", { name: "Contract lamps" });
    await world.follow("shopper", lamps);
    await world.publishListing("shopper", lamps, { title: "Contract desk lamp" });
    expect((await world.notificationsOf("shopper")).filter((note) => note.kind === "new-listing")).toEqual([]);
  });
}
