import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFormState } from "@/lib/auth/form-state";
import { getNotifications, notifySearchMatch } from "@/lib/data/notifications";
import { addSavedSearch, listSavedSearches } from "@/lib/data/saved-searches";
import { resetSampleStore, sampleStore } from "@/lib/data/store";
import { takeNote } from "@/lib/looking-for/form-state";
import { issueOnceToken, ONCE_TTL_MS, sentOnceToken, takeOnceToken } from "@/lib/staff/once";
import type { MatchQuery } from "@/lib/types";
import { redirectOf, redirectSignalOf, resetRequest, type FakeRequest } from "@/tests/helpers/next-request";
import { form, signedInAs, STAFF_NOW } from "@/tests/helpers/staff";
import { deleteSearch, pauseSearchAlerts, resumeSearchAlerts, saveThisSearch } from "./actions";
import { SAVED_SEARCHES_FORM, saveSearchNoteKey } from "./rules";

const request = vi.hoisted((): FakeRequest => ({ cookies: new Map(), sent: new Map(), proto: "http" }));

vi.mock("next/headers", async () => (await import("@/tests/helpers/next-request")).nextHeaders(request));
vi.mock("next/navigation", async () => (await import("@/tests/helpers/next-request")).nextNavigation());
vi.mock("next/server", async () => (await import("@/tests/helpers/next-request")).nextServer());
vi.mock("next/cache", async () => (await import("@/tests/helpers/next-request")).nextCache(request));

beforeEach(() => {
  resetSampleStore();
  resetRequest(request);
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(STAFF_NOW);
});

const asStudent = () => signedInAs(request, "acc-student");

/** Save this search's hidden fields on "calculator" in Tech at Midrand, under R100 (spec 2.5). */
const FROM = "/browse?q=calculator&cat=tech&campus=midrand&price=under-100";
const SAVE = { q: "calculator", cat: "tech", campus: "midrand", price: "under-100", pay: "", deals: "", from: FROM };
const CALCULATOR: MatchQuery = {
  q: "calculator",
  category: "tech",
  campus: "midrand",
  price: "under-100",
  pay: null,
  deals: null,
};

/**
 * Save this search's post as the row draws it (plan amendment 3): its hidden fields and a new one-time token, which
 * is "" when nobody is signed in. `fields` replaces any of them, `once` included.
 */
const saving = async (fields: Record<string, string> = {}) =>
  form({ ...SAVE, ...fields, once: fields.once ?? (await issueOnceToken()) ?? "" });

const FORGED = "00000000-0000-4000-8000-000000000000";

describe("Save this search (search alerts spec 2.5 and 2.6)", () => {
  it("saves it, and goes back to the same browse link with a status line", async () => {
    await asStudent();
    const redirect = await redirectSignalOf(async () => saveThisSearch(await saving()));
    expect([redirect.url, redirect.type, request.refreshed]).toEqual([FROM, "replace", true]);
    expect(await listSavedSearches("acc-student")).toMatchObject([
      { label: "“calculator” in Tech at Midrand, under R100", paused: false },
    ]);
    expect(await readFormState(saveSearchNoteKey(CALCULATOR))).toMatchObject({ notice: "saved", errors: [] });
  });

  it("takes the account from the session, never from the form", async () => {
    await asStudent();
    await redirectOf(async () => saveThisSearch(await saving({ account: "acc-mentor", accountId: "acc-mentor" })));
    expect(await listSavedSearches("acc-mentor")).toEqual([]);
    expect(await listSavedSearches("acc-student")).toHaveLength(1);
  });

  it("says when it's saved already, or 20 are kept, saving nothing more", async () => {
    await asStudent();
    await addSavedSearch("acc-student", CALCULATOR, STAFF_NOW);
    await redirectOf(async () => saveThisSearch(await saving()));
    expect(await readFormState(saveSearchNoteKey(CALCULATOR))).toMatchObject({ notice: null, errors: ["already"] });
    for (let n = 0; n < 19; n += 1) await addSavedSearch("acc-student", { ...CALCULATOR, q: `lamp${n}` }, STAFF_NOW);
    await redirectOf(async () => saveThisSearch(await saving({ q: "desk lamp", from: "/browse?q=desk+lamp" })));
    expect(await readFormState(saveSearchNoteKey({ ...CALCULATOR, q: "desk lamp" }))).toMatchObject({
      errors: ["limit"],
    });
    expect(await listSavedSearches("acc-student")).toHaveLength(20);
  });

  it("reads the fields as browse does: the max alias, the campus always kept, sort and n dropped", async () => {
    await asStudent();
    const posted = { q: "lamp", campus: "all", max: "250", sort: "price-low", n: "48", from: "/browse?q=lamp&max=250" };
    await redirectOf(async () => saveThisSearch(form({ ...posted, once: (await issueOnceToken()) ?? "" })));
    expect([...sampleStore().savedSearches.values()]).toMatchObject([
      { accountId: "acc-student", q: "lamp", category: null, campus: "all", price: "under-250", pay: null, deals: null },
    ]);
  });

  it("goes back only to a browse link, or else to the search's own results (plan decision 9)", async () => {
    await asStudent();
    expect(await redirectOf(async () => saveThisSearch(await saving({ from: "https://evil.example/browse" })))).toBe(FROM);
    expect(await redirectOf(async () => saveThisSearch(await saving({ q: "kettle", from: "/account" })))).toBe(
      "/browse?q=kettle&cat=tech&campus=midrand&price=under-100",
    );
  });

  it("saves nothing that isn't worth saving: a campus alone", async () => {
    await asStudent();
    const campusOnly = { q: "", cat: "", campus: "midrand", price: "", pay: "", deals: "", from: "/browse?campus=midrand" };
    expect(await redirectOf(async () => saveThisSearch(await saving(campusOnly)))).toBe("/browse?campus=midrand");
    expect(sampleStore().savedSearches.size).toBe(0);
  });

  it("sends a signed-out visitor to sign in, coming back to the same browse link", async () => {
    expect(await redirectOf(async () => saveThisSearch(await saving()))).toBe(`/login?next=${encodeURIComponent(FROM)}`);
    expect(sampleStore().savedSearches.size).toBe(0);
  });
});

describe("Save this search is made once, however many times its form is sent (plan amendment 3)", () => {
  it("saves once from two posts with one token, and both leave “saved” for the row", async () => {
    await asStudent();
    const once = (await issueOnceToken())!;
    const first = await redirectSignalOf(async () => saveThisSearch(await saving({ once })));
    expect(first.url).toBe(FROM);
    expect(await sentOnceToken(once, STAFF_NOW)).toEqual({ path: FROM, notice: "saved" });
    // Reading the line clears it, so the second post has to leave its own rather than find the first's.
    expect(await takeNote(saveSearchNoteKey(CALCULATOR))).toMatchObject({ notice: "saved", errors: [] });
    expect(await readFormState(saveSearchNoteKey(CALCULATOR))).toBeNull();
    const again = await redirectSignalOf(async () => saveThisSearch(await saving({ once })));
    expect([again.url, again.type, request.refreshed]).toEqual([FROM, "replace", true]);
    expect(await readFormState(saveSearchNoteKey(CALCULATOR))).toMatchObject({ notice: "saved", errors: [] });
    expect(await listSavedSearches("acc-student")).toHaveLength(1);
  });

  it("goes on to save when the post that took the token has not yet said where it went", async () => {
    await asStudent();
    const once = (await issueOnceToken())!;
    // The first has taken the token and is still saving.
    expect(await takeOnceToken(once, STAFF_NOW)).toEqual({ kind: "first" });
    expect(await redirectOf(async () => saveThisSearch(await saving({ once })))).toBe(FROM);
    expect(await listSavedSearches("acc-student")).toHaveLength(1);
    expect(await readFormState(saveSearchNoteKey(CALCULATOR))).toMatchObject({ notice: "saved", errors: [] });
  });

  it("still saves a post with no token, a made-up one or one that has run out, and leaves no token behind", async () => {
    await asStudent();
    const old = (await issueOnceToken())!;
    vi.setSystemTime(new Date(STAFF_NOW.getTime() + ONCE_TTL_MS));
    // A different search for each, so none is turned away as the same search saved already.
    for (const [n, once] of ["", FORGED, "x".repeat(100_000), old].entries()) {
      const back = `/browse?q=lamp${n}`;
      expect(await redirectOf(async () => saveThisSearch(await saving({ once, q: `lamp${n}`, from: back })))).toBe(back);
    }
    expect(await listSavedSearches("acc-student")).toHaveLength(4);
    // Nothing is written under a token this session never made.
    expect([...sampleStore().formStates.values()].filter((row) => row.form.startsWith("staff-once:"))).toEqual([]);
  });
});

describe("Pause, Resume and Delete on Saved (spec 2.8, plan decision 11)", () => {
  const saved = async (accountId = "acc-student") => {
    await addSavedSearch(accountId, CALCULATOR, STAFF_NOW);
    return (await listSavedSearches(accountId))[0];
  };

  it("pauses and resumes alerts, back on the Searches tab with a status line", async () => {
    await asStudent();
    const { id, label, href } = await saved();
    const redirect = await redirectSignalOf(() => pauseSearchAlerts(form({ search: id })));
    expect([redirect.url, redirect.type, request.refreshed]).toEqual(["/saved?tab=searches", "replace", true]);
    expect((await listSavedSearches("acc-student"))[0].paused).toBe(true);
    expect(await readFormState(SAVED_SEARCHES_FORM)).toMatchObject({ notice: "paused", values: { label, href } });
    await redirectOf(() => resumeSearchAlerts(form({ search: id })));
    expect((await listSavedSearches("acc-student"))[0].paused).toBe(false);
    expect(await readFormState(SAVED_SEARCHES_FORM)).toMatchObject({ notice: "resumed", values: { label, href } });
  });

  it("deletes the search and its notifications, keeping its label and link for the status line", async () => {
    await asStudent();
    const { id, label, href } = await saved();
    await notifySearchMatch({
      accountId: "acc-student",
      savedSearchId: id,
      label,
      resultsHref: href,
      listing: { id: "l-001", title: "Casio fx-991ZA Plus calculator" },
      now: STAFF_NOW,
    });
    expect(await redirectOf(() => deleteSearch(form({ search: id })))).toBe("/saved?tab=searches");
    expect(await listSavedSearches("acc-student")).toEqual([]);
    expect((await getNotifications("acc-student", 50)).some((item) => item.kind === "search-match")).toBe(false);
    expect(await readFormState(SAVED_SEARCHES_FORM)).toMatchObject({
      notice: "deleted",
      values: { label: "“calculator” in Tech at Midrand, under R100", href: FROM },
    });
  });

  it("changes nothing of someone else's, and says nothing", async () => {
    const theirs = await saved("acc-mentor");
    await asStudent();
    await redirectOf(() => pauseSearchAlerts(form({ search: theirs.id })));
    await redirectOf(() => deleteSearch(form({ search: theirs.id })));
    await redirectOf(() => deleteSearch(form({ search: "Not an id!" })));
    expect(await listSavedSearches("acc-mentor")).toMatchObject([{ id: theirs.id, paused: false }]);
    expect(await readFormState(SAVED_SEARCHES_FORM)).toBeNull();
  });

  it("sends a signed-out visitor to sign in, back to the tab", async () => {
    expect(await redirectOf(() => deleteSearch(form({ search: "ss-1" })))).toBe("/login?next=%2Fsaved%3Ftab%3Dsearches");
    expect(await redirectOf(() => pauseSearchAlerts(form({ search: "ss-1" })))).toBe(
      "/login?next=%2Fsaved%3Ftab%3Dsearches",
    );
  });
});
