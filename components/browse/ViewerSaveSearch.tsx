import { getViewer } from "@/lib/auth/session";
import { getSaveSearchState } from "@/lib/data/saved-searches";
import { takeNote } from "@/lib/looking-for/form-state";
import { saveNoteOf, saveSearchNoteKey } from "@/lib/saved-searches/rules";
import { issueOnceToken } from "@/lib/staff/once";
import type { MatchQuery } from "@/lib/types";
import { SaveSearchRow, SaveSearchSignedOut } from "./SaveSearchViews";

/**
 * Save this search once the session is read (search alerts spec 2.6): the sign-in link when signed out; otherwise the
 * button, "saved" or "at the limit", with the last press's line for this search, taken once. The button's form carries
 * a one-time token (plan amendment 3), made only when the button is shown. An async Server Component:
 * SaveSearchControl puts it inside <Suspense>. A failed session read gives the signed-out row.
 */
export async function ViewerSaveSearch({ search, from }: { search: MatchQuery; from: string }) {
  const account = await getViewer().catch(() => null);
  if (!account) return <SaveSearchSignedOut from={from} />;
  const [state, note] = await Promise.all([
    getSaveSearchState(account.id, search),
    takeNote(saveSearchNoteKey(search)),
  ]);
  const once = state === "new" && !note ? await issueOnceToken() : null;
  return <SaveSearchRow search={search} from={from} state={state} note={saveNoteOf(note)} once={once} />;
}
