import { beforeEach, describe, expect, it } from "vitest";
import type { MatchQuery } from "@/lib/types";
import { makeListingRow } from "@/tests/helpers/fakes";
import { getNotifications } from "./notifications";
import {
  addSavedSearch,
  deleteSavedSearch,
  exportSavedSearches,
  forgetSavedSearchesOf,
  getSaveSearchState,
  listSavedSearches,
  notifySavedSearches,
  setSavedSearchPaused,
} from "./saved-searches";
import { resetSampleStore, sampleStore } from "./store";

const at = (hour: number) => new Date(`2026-10-14T${String(hour).padStart(2, "0")}:00:00.000Z`);

/** "calculator" at Midrand, unless the test says otherwise. */
const search = (overrides: Partial<MatchQuery> = {}): MatchQuery => ({
  q: "calculator",
  category: null,
  campus: "midrand",
  price: null,
  pay: null,
  deals: null,
  ...overrides,
});

/** A listing Tech corner has just published (F's row: an available R100 tech item at Midrand), by its id. */
const publish = (overrides: Parameters<typeof makeListingRow>[0] = {}) => {
  const row = makeListingRow({ id: "l-new", title: "Casio calculator, barely used", ...overrides });
  sampleStore().listings.set(row.id, row);
  return row.id;
};

const matches = async (accountId: string) =>
  (await getNotifications(accountId, 50)).filter((item) => item.kind === "search-match");

const idOf = async (accountId: string, label: string) =>
  (await listSavedSearches(accountId)).find((item) => item.label === label)!.id;

beforeEach(() => {
  resetSampleStore();
});

describe("saving searches (search alerts spec 2.1 and 2.4)", () => {
  it("saves one with an ss- id, and lists them newest first with their labels and pinned links", async () => {
    expect(await addSavedSearch("acc-student", search({ category: "tech", price: "under-100" }), at(8))).toBe("saved");
    expect(await addSavedSearch("acc-student", search({ q: null, category: "res-living", campus: "all" }), at(9))).toBe(
      "saved",
    );
    expect(await listSavedSearches("acc-student")).toEqual([
      {
        id: expect.stringMatching(/^ss-[0-9a-f-]{36}$/),
        label: "Res & living at every campus",
        href: "/browse?cat=res-living&campus=all",
        savedAt: at(9).toISOString(),
        paused: false,
      },
      {
        id: expect.stringMatching(/^ss-[0-9a-f-]{36}$/),
        label: "“calculator” in Tech at Midrand, under R100",
        href: "/browse?q=calculator&cat=tech&campus=midrand&price=under-100",
        savedAt: at(8).toISOString(),
        paused: false,
      },
    ]);
    expect(await listSavedSearches("acc-mentor")).toEqual([]);
  });

  it("knows the same search in other words, whatever the case, accents or order", async () => {
    await addSavedSearch("acc-student", search({ q: "Casio calculator" }), at(8));
    expect(await addSavedSearch("acc-student", search({ q: "calculator CÁSIO" }), at(9))).toBe("already");
    expect(await getSaveSearchState("acc-student", search({ q: "casio calculator" }))).toBe("saved");
    expect(await getSaveSearchState("acc-student", search({ q: "casio" }))).toBe("new");
    expect(await getSaveSearchState("acc-student", search({ q: "casio calculator", campus: "all" }))).toBe("new");
    expect(sampleStore().savedSearches.size).toBe(1);
  });

  it("keeps 20 at most, and says so", async () => {
    for (let n = 0; n < 20; n += 1) await addSavedSearch("acc-student", search({ q: `lamp${n}` }), at(8));
    expect(await addSavedSearch("acc-student", search(), at(9))).toBe("limit");
    expect(await getSaveSearchState("acc-student", search())).toBe("limit");
    expect(await getSaveSearchState("acc-student", search({ q: "lamp3" }))).toBe("saved");
    expect(await addSavedSearch("acc-mentor", search(), at(9))).toBe("saved");
  });
});

describe("pausing, resuming and deleting (spec 2.8, plan decision 11)", () => {
  it("pauses and resumes the owner's search only, keeping when it was first paused", async () => {
    await addSavedSearch("acc-student", search(), at(8));
    const id = await idOf("acc-student", "“calculator” at Midrand");
    expect(await setSavedSearchPaused("acc-mentor", id, true, at(9))).toBeNull();
    expect(await setSavedSearchPaused("acc-student", id, true, at(9))).toMatchObject({
      id,
      label: "“calculator” at Midrand",
      paused: true,
    });
    expect(await setSavedSearchPaused("acc-student", id, true, at(10))).toMatchObject({ paused: true });
    expect(sampleStore().savedSearches.get(id)?.pausedAt).toBe(at(9).toISOString());
    expect(await setSavedSearchPaused("acc-student", id, false, at(11))).toMatchObject({ paused: false });
    expect(sampleStore().savedSearches.get(id)?.pausedAt).toBeNull();
  });

  it("deletes the owner's search with its notifications, saying what it was", async () => {
    await addSavedSearch("acc-student", search(), at(8));
    const id = await idOf("acc-student", "“calculator” at Midrand");
    await notifySavedSearches({ listingId: publish(), now: at(9) });
    expect(await matches("acc-student")).toHaveLength(1);
    expect(await deleteSavedSearch("acc-mentor", id)).toBeNull();
    expect(await deleteSavedSearch("acc-student", id)).toMatchObject({
      label: "“calculator” at Midrand",
      href: "/browse?q=calculator&campus=midrand",
    });
    expect(sampleStore().savedSearches.has(id)).toBe(false);
    expect(await matches("acc-student")).toEqual([]);
  });
});

describe("telling students about a new listing (spec 2.9 to 2.11, plan decision 13)", () => {
  it("tells a matching search's account, naming the listing", async () => {
    await addSavedSearch("acc-student", search(), at(8));
    expect(await notifySavedSearches({ listingId: publish(), now: at(9) })).toBe(1);
    expect(await matches("acc-student")).toMatchObject([
      {
        text: "Casio calculator, barely used matches your search “calculator” at Midrand",
        href: "/listings/l-new",
        isNew: true,
      },
    ]);
  });

  it("matches by browse's rules: the shop's name counts; another campus or category doesn't", async () => {
    await addSavedSearch("acc-student", search({ q: "tech corner", campus: "all" }), at(8));
    await addSavedSearch("acc-mentor", search({ campus: "pretoria" }), at(8));
    await addSavedSearch("acc-admin", search({ category: "food" }), at(8));
    expect(await notifySavedSearches({ listingId: publish(), now: at(9) })).toBe(1);
    expect(await matches("acc-student")).toHaveLength(1);
    expect(await matches("acc-mentor")).toEqual([]);
    expect(await matches("acc-admin")).toEqual([]);
  });

  it("tells an account once, under its oldest matching search", async () => {
    await addSavedSearch("acc-student", search({ q: null, category: "tech" }), at(7));
    await addSavedSearch("acc-student", search(), at(8));
    const oldest = await idOf("acc-student", "Tech at Midrand");
    await notifySavedSearches({ listingId: publish(), now: at(9) });
    expect(await matches("acc-student")).toMatchObject([
      { text: "Casio calculator, barely used matches your search Tech at Midrand" },
    ]);
    const rows = [...sampleStore().notifications.values()].filter((row) => row.kind === "search-match");
    expect(rows.map((row) => row.subjectId)).toEqual([oldest]);
  });

  it("skips paused searches, the shop's own owner, and listings buyers can't see", async () => {
    await addSavedSearch("acc-seller", search(), at(7));
    await addSavedSearch("acc-mentor", search(), at(7));
    await setSavedSearchPaused("acc-mentor", await idOf("acc-mentor", "“calculator” at Midrand"), true, at(7));
    expect(await notifySavedSearches({ listingId: publish(), now: at(9) })).toBe(0);
    await addSavedSearch("acc-student", search(), at(8));
    expect(await notifySavedSearches({ listingId: publish({ id: "l-draft", state: "draft" }), now: at(9) })).toBe(0);
    const hidden = publish({ id: "l-hidden", hiddenAt: at(8).toISOString(), hiddenReason: "Not allowed on CampusCart." });
    expect(await notifySavedSearches({ listingId: hidden, now: at(9) })).toBe(0);
    sampleStore().sellerProfiles.get("acc-seller")!.status = "paused";
    expect(await notifySavedSearches({ listingId: publish({ id: "l-paused-shop" }), now: at(9) })).toBe(0);
    expect(await notifySavedSearches({ listingId: "l-nope", now: at(9) })).toBe(0);
    expect(await matches("acc-student")).toEqual([]);
  });
});

describe("deleting an account, and its data export (spec 2.15, plan decision 15)", () => {
  it("forgets the account's saved searches and their notifications, and no one else's", async () => {
    await addSavedSearch("acc-student", search(), at(8));
    await addSavedSearch("acc-mentor", search(), at(8));
    await notifySavedSearches({ listingId: publish(), now: at(9) });
    await forgetSavedSearchesOf("acc-student");
    expect([...sampleStore().savedSearches.values()].map((row) => row.accountId)).toEqual(["acc-mentor"]);
    expect(await matches("acc-student")).toEqual([]);
    expect(await matches("acc-mentor")).toHaveLength(1);
  });

  it("exports each search by name, newest first, with no ids", async () => {
    await addSavedSearch("acc-student", search({ category: "tech", price: "under-100", pay: "cash" }), at(8));
    const textbooks = search({ q: null, category: "textbooks-notes", campus: "all", deals: "free-and-swaps" });
    await addSavedSearch("acc-student", textbooks, at(9));
    const label = "Textbooks & notes at every campus, free & swaps";
    await setSavedSearchPaused("acc-student", await idOf("acc-student", label), true, at(10));
    const exported = await exportSavedSearches("acc-student");
    expect(exported).toEqual([
      {
        label,
        words: null,
        category: "Textbooks & notes",
        campus: "Every campus",
        price: null,
        pay: null,
        deals: "Free & swaps",
        alerts: "paused",
        savedAt: at(9).toISOString(),
      },
      {
        label: "“calculator” in Tech at Midrand, under R100, cash",
        words: "calculator",
        category: "Tech",
        campus: "Midrand",
        price: "Under R100",
        pay: "Cash",
        deals: null,
        alerts: "on",
        savedAt: at(8).toISOString(),
      },
    ]);
    expect(JSON.stringify(exported)).not.toContain("ss-");
    expect(await exportSavedSearches("acc-mentor")).toEqual([]);
  });
});
