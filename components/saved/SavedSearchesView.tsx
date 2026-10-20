import Link from "next/link";
import { signInHref } from "@/lib/next-path";
import { deleteSearch, pauseSearchAlerts, resumeSearchAlerts } from "@/lib/saved-searches/actions";
import { SAVED_SEARCHES_PATH, type SavedSearchNotice } from "@/lib/saved-searches/rules";
import { alertsNoticeText, savedSearchesCount } from "@/lib/saved-searches/words";
import { shortSastDate } from "@/lib/time";
import type { SavedSearchItem } from "@/lib/types";

type SavedSearchesViewProps = {
  /** Newest first; null when signed out. */
  searches: readonly SavedSearchItem[] | null;
  /** The last Pause, Resume or Delete, once (plan decision 7). */
  notice: SavedSearchNotice | null;
};

/** The last press's status line (spec section 4). Delete's links to the search's results, to save it again (spec 2.8). */
function Notice({ notice }: { notice: SavedSearchNotice }) {
  return (
    <p role="status" className="form-notice saved-searches-notice">
      {notice.code === "deleted" ? (
        <>
          Deleted{" "}
          <Link href={notice.href} prefetch={false}>
            {notice.label}
          </Link>
          .
        </>
      ) : (
        alertsNoticeText(notice.code, notice.label)
      )}
    </p>
  );
}

/**
 * Saved's Searches tab (search alerts spec 2.7, 2.8 and section 4; plan decisions 10 and 11): newest first, each with
 * its label linking to its results, when it was saved, whether its alerts are on, and Pause or Resume and Delete,
 * which come back here with a status line. No confirm pages: pausing loses nothing, and a deleted search is one press
 * from coming back. No prefetch on the results: browse carries client code (spec 5). The forms hold only a hidden
 * id and have no fields, so nothing clashes on the pages Next keeps hidden.
 */
export function SavedSearchesView({ searches, notice }: SavedSearchesViewProps) {
  if (searches === null) {
    return (
      <section aria-labelledby="saved-searches-title" className="saved-empty">
        <h2 id="saved-searches-title" className="saved-empty-title">
          Saved searches
        </h2>
        <p>Sign in to save searches. They&apos;ll show here.</p>
        <Link href={signInHref(SAVED_SEARCHES_PATH)} prefetch={false} className="btn btn-primary">
          Sign in
        </Link>
      </section>
    );
  }
  return (
    <section aria-labelledby="saved-searches-title">
      <h2 id="saved-searches-title" className="sr-only">
        Saved searches
      </h2>
      {notice && <Notice notice={notice} />}
      {searches.length === 0 ? (
        <div className="saved-empty">
          <p className="saved-empty-title">No saved searches yet</p>
          <p>Search on Browse and press Save this search.</p>
          <Link href="/browse" prefetch={false} className="btn btn-primary">
            Browse
          </Link>
        </div>
      ) : (
        <>
          <p className="saved-count">{savedSearchesCount(searches.length)}</p>
          <ul className="saved-searches">
            {searches.map((search) => (
              <li key={search.id} className="saved-search">
                <Link href={search.href} prefetch={false} className="saved-search-label">
                  {search.label}
                </Link>
                <p className="saved-search-meta">
                  Saved <time dateTime={search.savedAt}>{shortSastDate(search.savedAt)}</time>
                  {" · "}
                  <span className="saved-search-state">{search.paused ? "Paused" : "Alerts on"}</span>
                </p>
                <div className="saved-search-actions">
                  <form action={search.paused ? resumeSearchAlerts : pauseSearchAlerts}>
                    <input type="hidden" name="search" value={search.id} />
                    <button type="submit" className="btn btn-outline text-navy saved-search-btn">
                      {search.paused ? "Resume alerts" : "Pause alerts"}{" "}
                      <span className="sr-only">for {search.label}</span>
                    </button>
                  </form>
                  <form action={deleteSearch}>
                    <input type="hidden" name="search" value={search.id} />
                    <button type="submit" className="btn btn-outline text-navy saved-search-btn">
                      Delete <span className="sr-only">saved search {search.label}</span>
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
