import { SAVED_SEARCH_LIMIT, type SaveNote } from "./rules";

// Saved searches' words (search alerts spec 2.6 to 2.8 and 2.12; plan decisions 14 and 18): the browse row's lines,
// the Searches tab's note, count and status lines, and the notification's sentences. Samples for Lama to change.

/** The row's line before a save, signed in or out (spec 2.6). */
export const SAVE_SEARCH_PROMPT = "Hear when something new matches.";
export const SAVE_SEARCH_BUTTON = "Save this search";
export const MANAGE_SEARCHES = "Manage saved searches";
export const ALREADY_SAVED_LINE = "You've saved this search.";
export const AT_LIMIT_LINE = `You're at the ${SAVED_SEARCH_LIMIT}-search limit.`;

/** The line after a press (spec 2.6): a status after a save, an alert after a refusal. */
export function saveNoteText(note: SaveNote): string {
  switch (note) {
    case "saved":
      return "Search saved.";
    case "already":
      return "You've saved this search already.";
    case "limit":
      return AT_LIMIT_LINE;
  }
}

/** The Searches tab's note (spec 2.7). */
export const SEARCHES_NOTE = "Kept with your account. Each search sends at most one notification a day.";

/** "1 saved search", "3 saved searches". */
export function savedSearchesCount(count: number): string {
  return count === 1 ? "1 saved search" : `${count} saved searches`;
}

/** Pause's and Resume's status lines (spec section 4). Delete's links its label, so the view writes it (spec 2.8). */
export function alertsNoticeText(code: "paused" | "resumed", label: string): string {
  return code === "paused" ? `Alerts paused for ${label}.` : `Alerts on for ${label}.`;
}

/** A saved search's first match of the day, or its first since it was read (spec 2.12), linking to the listing. */
export function searchMatchText(title: string, label: string): string {
  return `${title} matches your search ${label}`;
}

/** The same notification once more match while it's unread, linking to the results, Newest first. */
export function searchMatchesText(count: number, label: string): string {
  return `${count} new listings match your search ${label}`;
}
