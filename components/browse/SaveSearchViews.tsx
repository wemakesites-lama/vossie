import Link from "next/link";
import { signInHref } from "@/lib/next-path";
import { saveThisSearch } from "@/lib/saved-searches/actions";
import { SAVED_SEARCHES_PATH, type SaveNote } from "@/lib/saved-searches/rules";
import {
  ALREADY_SAVED_LINE,
  AT_LIMIT_LINE,
  MANAGE_SEARCHES,
  SAVE_SEARCH_BUTTON,
  SAVE_SEARCH_PROMPT,
  saveNoteText,
} from "@/lib/saved-searches/words";
import type { MatchQuery, SaveSearchState } from "@/lib/types";

// Save this search's views (search alerts spec 2.5 and 2.6; plan amendment 2). They live apart from SaveSearchControl,
// which imports the session's part: tests and the test helper import these, never the control, so a mocked
// ViewerSaveSearch can't wait on a factory that imports itself.

/** Save this search for a signed-out visitor, and the static shell: sign in, then back to the same results (spec 2.6). */
export function SaveSearchSignedOut({ from }: { from: string }) {
  return (
    <>
      <p className="save-search-line">{SAVE_SEARCH_PROMPT}</p>
      <Link href={signInHref(from)} prefetch={false} className="btn btn-outline text-navy save-search-btn">
        {SAVE_SEARCH_BUTTON}
      </Link>
    </>
  );
}

/** Manage saved searches (spec 2.6). No prefetch: Saved carries the hearts' client code (spec 5). */
function ManageLink() {
  return (
    <Link href={SAVED_SEARCHES_PATH} prefetch={false} className="save-search-manage">
      {MANAGE_SEARCHES}
    </Link>
  );
}

type SaveSearchRowProps = {
  search: MatchQuery;
  /** The browse link it's on, to come back to. */
  from: string;
  state: SaveSearchState;
  /** What the last press said, once (plan decision 7). */
  note: SaveNote | null;
  /** The form's one-time token (plan amendment 3); null when none could be made. */
  once: string | null;
};

/**
 * The row once the session is read (spec 2.6, plan decision 6): one short line and one 44px control. After a press
 * the line says what happened: "Search saved." as a status, a refusal as an alert. The button is a plain form, so it
 * works before the app's JavaScript arrives.
 */
export function SaveSearchRow({ search, from, state, note, once }: SaveSearchRowProps) {
  if (note) {
    return (
      <>
        <p role={note === "saved" ? "status" : "alert"} className="save-search-line">
          {saveNoteText(note)}
        </p>
        <ManageLink />
      </>
    );
  }
  if (state !== "new") {
    return (
      <>
        <p className="save-search-line">{state === "saved" ? ALREADY_SAVED_LINE : AT_LIMIT_LINE}</p>
        <ManageLink />
      </>
    );
  }
  return (
    <>
      <p className="save-search-line">{SAVE_SEARCH_PROMPT}</p>
      <form action={saveThisSearch}>
        <input type="hidden" name="q" value={search.q ?? ""} />
        <input type="hidden" name="cat" value={search.category ?? ""} />
        <input type="hidden" name="campus" value={search.campus} />
        <input type="hidden" name="price" value={search.price ?? ""} />
        <input type="hidden" name="pay" value={search.pay ?? ""} />
        <input type="hidden" name="deals" value={search.deals ?? ""} />
        <input type="hidden" name="from" value={from} />
        <input type="hidden" name="once" value={once ?? ""} />
        <button type="submit" className="btn btn-outline text-navy save-search-btn">
          {SAVE_SEARCH_BUTTON}
        </button>
      </form>
    </>
  );
}
