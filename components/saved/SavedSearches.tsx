import { getViewer } from "@/lib/auth/session";
import { listSavedSearches } from "@/lib/data/saved-searches";
import { takeNote } from "@/lib/looking-for/form-state";
import { SAVED_SEARCHES_FORM, savedSearchNoticeOf } from "@/lib/saved-searches/rules";
import { SavedSearchesView } from "./SavedSearchesView";

/** The Searches tab for this request's visitor (search alerts spec 2.7). Request-time: inside Saved's <Suspense>. */
export async function SavedSearches() {
  const account = await getViewer().catch(() => null);
  if (!account) return <SavedSearchesView searches={null} notice={null} />;
  const [searches, note] = await Promise.all([listSavedSearches(account.id), takeNote(SAVED_SEARCHES_FORM)]);
  return <SavedSearchesView searches={searches} notice={savedSearchNoticeOf(note)} />;
}
