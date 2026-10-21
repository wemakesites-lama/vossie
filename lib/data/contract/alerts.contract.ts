import { afterEach, beforeEach, expect, it } from "vitest";
import { markNotificationsRead } from "@/lib/data/notifications";
import {
  addSavedSearch,
  deleteSavedSearch,
  exportSavedSearches,
  getSaveSearchState,
  listSavedSearches,
  notifySavedSearches,
  setSavedSearchPaused,
} from "@/lib/data/saved-searches";
import { ALL_CAMPUSES } from "@/lib/campus";
import { savedSearchHref } from "@/lib/saved-searches/rules";
import { searchMatchesText, searchMatchText } from "@/lib/saved-searches/words";
import type { MatchQuery } from "@/lib/types";
import type { World, WorldAccountName } from "@/tests/contract/world";

// Saved searches and their alerts in both backends (C4/C5 plan Task 8; decisions 6, 9 and 10): saving (the same words
// in any order are the same search, at most 20), the browse row's state, Saved's Searches tab, Pause, Resume and
// Delete, the download, and the matching of a first publish against every active search with browse's own
// listingMatches, once a day per search, never the shop's owner, a paused search or a listing buyers can't see.
// alerts.test.ts runs it on the sample store, alerts.db.test.ts on the local stack.

const query = (search: Partial<MatchQuery>): MatchQuery => ({
  q: null,
  category: null,
  campus: ALL_CAMPUSES,
  price: null,
  pay: null,
  deals: null,
  ...search,
});

export function alertsContract(makeWorld: () => World): void {
  let world: World;
  let asker: string;
  beforeEach(async () => {
    world = makeWorld();
    await world.tidyCommunity();
    await world.tidySelling("shopper");
    await world.tidyMessaging();
    asker = await world.signedIn("asker");
  });
  afterEach(async () => {
    await world.cleanup();
  });

  const as = <T>(read: () => Promise<T>) => world.asViewer("asker", read);

  // --- Saving ------------------------------------------------------------------------------------------------------

  it("saves a search once, whatever the order of its words, and says so on the browse row", async () => {
    const casio = query({ q: "casio calculator", category: "tech", campus: "pretoria", price: "under-500" });
    expect(await as(() => getSaveSearchState(asker, casio))).toBe("new");
    expect(await as(() => addSavedSearch(asker, casio, new Date()))).toBe("saved");
    expect(await as(() => getSaveSearchState(asker, casio))).toBe("saved");
    expect(await as(() => addSavedSearch(asker, { ...casio, q: "Calculator CASIO" }, new Date()))).toBe("already");
    expect(await as(() => listSavedSearches(asker))).toEqual([
      {
        id: expect.any(String),
        label: "“casio calculator” in Tech at Pretoria, under R500",
        href: savedSearchHref(casio),
        savedAt: expect.any(String),
        paused: false,
      },
    ]);
  });

  it("stops at 20", async () => {
    for (let n = 1; n <= 20; n += 1) await world.saveSearch("asker", { q: `contract word${String.fromCharCode(96 + n)}` });
    const more = query({ q: "one more" });
    expect(await as(() => getSaveSearchState(asker, more))).toBe("limit");
    expect(await as(() => addSavedSearch(asker, more, new Date()))).toBe("limit");
    expect(await as(() => listSavedSearches(asker))).toHaveLength(20);
  });

  it("lists the account's searches newest first, pauses and resumes alerts, and never another's", async () => {
    const older = await world.saveSearch("asker", { q: "kettle" }, { at: new Date(Date.now() - 60_000) });
    const newer = await world.saveSearch("asker", { category: "tech" });
    const theirs = await world.saveSearch("shopper", { q: "toaster" });
    expect((await as(() => listSavedSearches(asker))).map((item) => [item.id, item.label])).toEqual([
      [newer, "Tech at every campus"],
      [older, "“kettle” at every campus"],
    ]);
    expect(await as(() => setSavedSearchPaused(asker, older, true, new Date()))).toMatchObject({ id: older, paused: true });
    expect(await as(() => setSavedSearchPaused(asker, older, true, new Date()))).toMatchObject({ id: older, paused: true });
    expect((await as(() => exportSavedSearches(asker))).map((row) => row.alerts)).toEqual(["on", "paused"]);
    expect(await as(() => setSavedSearchPaused(asker, older, false, new Date()))).toMatchObject({ id: older, paused: false });
    expect(await as(() => setSavedSearchPaused(asker, theirs, true, new Date()))).toBeNull();
    expect(await as(() => deleteSavedSearch(asker, theirs))).toBeNull();
  });

  it("deletes a search once, with its alerts", async () => {
    const id = await world.saveSearch("asker", { q: "kettle" });
    const label = "“kettle” at every campus";
    await world.addNotification("asker", { kind: "search-match", subjectId: id, text: `A kettle matches your search ${label}`, href: "/listings/l-001" });
    expect(await as(() => deleteSavedSearch(asker, id))).toMatchObject({ id, label, paused: false });
    expect(await as(() => deleteSavedSearch(asker, id))).toBeNull();
    expect(await as(() => listSavedSearches(asker))).toEqual([]);
    expect((await world.notificationsOf("asker")).filter((note) => note.subjectId === id)).toEqual([]);
  });

  it("puts the searches in the download by name, newest first, with no ids", async () => {
    await world.saveSearch("asker", { q: "kettle", campus: "pretoria", price: "free" }, { at: new Date(Date.now() - 60_000), paused: true });
    await world.saveSearch("asker", { category: "tech", pay: "swap", deals: "free-and-swaps" });
    expect(await as(() => exportSavedSearches(asker))).toEqual([
      {
        label: "Tech at every campus, swaps, free & swaps",
        words: null,
        category: "Tech",
        campus: "Every campus",
        price: null,
        pay: "Swaps",
        deals: "Free & swaps",
        alerts: "on",
        savedAt: expect.any(String),
      },
      {
        label: "“kettle” at Pretoria, free",
        words: "kettle",
        category: null,
        campus: "Pretoria",
        price: "Free",
        pay: null,
        deals: null,
        alerts: "paused",
        savedAt: expect.any(String),
      },
    ]);
  });

  // --- Alerts ------------------------------------------------------------------------------------------------------

  const matches = async (name: WorldAccountName) =>
    (await world.notificationsOf(name)).filter((note) => note.kind === "search-match");

  it("tells each account with an active matching search once, never the shop's owner or a paused search", async () => {
    const slug = await world.openShop("shopper", { name: "Contract sums" });
    const askers = await world.saveSearch("asker", { q: "calculator" });
    const staffs = await world.saveSearch("staff", { q: "calculator", campus: "pretoria" });
    await world.saveSearch("seller", { q: "calculator" }, { paused: true });
    await world.saveSearch("shopper", { q: "calculator" });
    await world.saveSearch("asker", { q: "kettle" });
    const listing = await world.publishListing("shopper", slug, { title: "Casio calculator" });
    expect(await notifySavedSearches({ listingId: listing, now: new Date() })).toBe(2);
    expect(await matches("asker")).toEqual([
      { kind: "search-match", subjectId: askers, text: searchMatchText("Casio calculator", "“calculator” at every campus"), href: `/listings/${listing}` },
    ]);
    expect(await matches("staff")).toEqual([
      { kind: "search-match", subjectId: staffs, text: searchMatchText("Casio calculator", "“calculator” at Pretoria"), href: `/listings/${listing}` },
    ]);
    expect(await matches("seller")).toEqual([]);
    expect(await matches("shopper")).toEqual([]);
  });

  it("counts more matches that day while it's unread, then starts again at one once it's read", async () => {
    const slug = await world.openShop("shopper", { name: "Contract sums" });
    const id = await world.saveSearch("asker", { q: "calculator" });
    const label = "“calculator” at every campus";
    const notify = async (title: string) => {
      const listing = await world.publishListing("shopper", slug, { title });
      await notifySavedSearches({ listingId: listing, now: new Date() });
      return listing;
    };
    await notify("Casio calculator");
    await notify("Sharp calculator");
    expect(await matches("asker")).toEqual([
      { kind: "search-match", subjectId: id, text: searchMatchesText(2, label), href: savedSearchHref(query({ q: "calculator" }), "new") },
    ]);
    await as(() => markNotificationsRead(asker, new Date()));
    const third = await notify("HP calculator");
    expect(await matches("asker")).toEqual([
      { kind: "search-match", subjectId: id, text: searchMatchText("HP calculator", label), href: `/listings/${third}` },
    ]);
    expect((await as(() => listSavedSearches(asker))).map((item) => item.id)).toEqual([id]);
  });

  it("tells no one about a listing buyers can't see: hidden, or in a paused shop", async () => {
    const slug = await world.openShop("shopper", { name: "Contract sums" });
    await world.saveSearch("asker", { q: "calculator" });
    const hidden = await world.publishListing("shopper", slug, { title: "Casio calculator" });
    await world.hideListing(hidden, "Contract reason");
    expect(await notifySavedSearches({ listingId: hidden, now: new Date() })).toBe(0);
    const paused = await world.publishListing("shopper", slug, { title: "Sharp calculator" });
    await world.pauseShop(slug, "seller");
    expect(await notifySavedSearches({ listingId: paused, now: new Date() })).toBe(0);
    expect(await matches("asker")).toEqual([]);
  });

  it("tells an account with two matching searches once, under the older", async () => {
    const slug = await world.openShop("shopper", { name: "Contract sums" });
    const older = await world.saveSearch("asker", { q: "calculator" }, { at: new Date(Date.now() - 60_000) });
    await world.saveSearch("asker", { category: "tech" });
    const listing = await world.publishListing("shopper", slug, { title: "Casio calculator" });
    expect(await notifySavedSearches({ listingId: listing, now: new Date() })).toBe(1);
    expect((await matches("asker")).map((note) => note.subjectId)).toEqual([older]);
  });
}
