"use server";

import { writeFormState } from "@/lib/auth/form-state";
import { requireAccount } from "@/lib/auth/session";
import { knownSlugs } from "@/lib/browse/query";
import { getCampuses, getCategories } from "@/lib/data";
import { addSavedSearch, deleteSavedSearch, setSavedSearchPaused } from "@/lib/data/saved-searches";
import { isId } from "@/lib/messaging/paths";
import { done, field } from "@/lib/selling/action-helpers";
import { leaveOnceToken, takeOnceToken } from "@/lib/staff/once";
import {
  browseFrom,
  isWorthSaving,
  SAVED_SEARCHES_FORM,
  SAVED_SEARCHES_PATH,
  saveSearchNoteKey,
  savedSearchFrom,
  savedSearchHref,
  SEARCH_FIELDS,
} from "./rules";

// Saved searches' actions (search alerts spec 2.5, 2.6 and 2.8; plan decisions 7, 9 and 11): plain forms, so they
// work before the app's JavaScript arrives. Identity comes only from the session; each leaves its line in D's form
// state for the page it lands on, and ends with F's done(), whose refresh() drops the browser's kept pages. Saved
// searches aren't cached and buyers never see them, so no tag is expired.

/**
 * Save this search (spec 2.5): the posted fields read as browse reads its link, saved for the signed-in account, and
 * back to the browse link it came from with "Search saved.", or why not.
 *
 * The form carries a one-time token (plan amendment 3), so a second press of the same form, or a repeat of its post,
 * leaves the same "saved" line and saves nothing more. Unlike other create forms, a post with no token, a made-up one
 * or one that has run out is not refused: the search key already keeps a save single, and a browse page left open for
 * more than an hour should still save.
 */
export async function saveThisSearch(formData: FormData): Promise<void> {
  const [campuses, categories] = await Promise.all([getCampuses(), getCategories()]);
  const params = Object.fromEntries(SEARCH_FIELDS.map((name) => [name, field(formData, name) || undefined]));
  const search = savedSearchFrom(params, knownSlugs(campuses, categories));
  const back = browseFrom(field(formData, "from")) ?? savedSearchHref(search);
  const account = await requireAccount(back);
  if (!isWorthSaving(search)) done(back);
  const now = new Date();
  // Only now, with a search about to be saved, is the token taken. A post whose token has saved already goes where
  // that save went, with the same line; one that came while the first is still saving goes on, and the search key
  // keeps it from saving twice.
  const token = field(formData, "once");
  const once = await takeOnceToken(token, now);
  if (once.kind === "again" && once.sent) {
    await writeFormState(saveSearchNoteKey(search), { errors: [], values: {}, notice: "saved" }, now);
    done(once.sent.path);
  }
  const result = await addSavedSearch(account.id, search, now);
  await writeFormState(
    saveSearchNoteKey(search),
    result === "saved" ? { errors: [], values: {}, notice: "saved" } : { errors: [result], values: {}, notice: null },
    now,
  );
  // A token this session never made has nothing to say where its save went, so nothing is written under it.
  if (result === "saved" && once.kind !== "none") await leaveOnceToken(token, { path: back, notice: "saved" }, now);
  done(back);
}

/** Pause alerts or Resume alerts (spec 2.8) on one of the account's saved searches, back to the Searches tab. */
async function setAlerts(formData: FormData, paused: boolean): Promise<void> {
  const account = await requireAccount(SAVED_SEARCHES_PATH);
  const id = field(formData, "search");
  if (isId(id)) {
    const now = new Date();
    const item = await setSavedSearchPaused(account.id, id, paused, now);
    if (item) {
      const values = { label: item.label, href: item.href };
      await writeFormState(SAVED_SEARCHES_FORM, { errors: [], values, notice: paused ? "paused" : "resumed" }, now);
    }
  }
  done(SAVED_SEARCHES_PATH);
}

export async function pauseSearchAlerts(formData: FormData): Promise<void> {
  await setAlerts(formData, true);
}

export async function resumeSearchAlerts(formData: FormData): Promise<void> {
  await setAlerts(formData, false);
}

/** Delete (spec 2.8): no confirm page; the status line links to the search's results, to save it again. */
export async function deleteSearch(formData: FormData): Promise<void> {
  const account = await requireAccount(SAVED_SEARCHES_PATH);
  const id = field(formData, "search");
  const item = isId(id) ? await deleteSavedSearch(account.id, id) : null;
  if (item) {
    const values = { label: item.label, href: item.href };
    await writeFormState(SAVED_SEARCHES_FORM, { errors: [], values, notice: "deleted" }, new Date());
  }
  done(SAVED_SEARCHES_PATH);
}
