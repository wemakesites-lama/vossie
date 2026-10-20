import { Suspense } from "react";
import { browseHref } from "@/lib/browse/href";
import { matchQueryOf, searchKey } from "@/lib/saved-searches/rules";
import type { BrowseQuery } from "@/lib/types";
import { SaveSearchSignedOut } from "./SaveSearchViews";
import { ViewerSaveSearch } from "./ViewerSaveSearch";

/**
 * Save this search under browse's chips (search alerts spec 2.5 and 2.6, plan decision 6): a box that's always there,
 * holding the session's part in its own <Suspense> with the signed-out row as the fallback, so the results never wait
 * for it and nothing moves when it streams in. The boundary is keyed by the search (plan amendment 6), so a client
 * move to another search starts a new form and never shows the last search's line. The campus is always posted: the
 * link's, or the viewer's chosen one, which browse shows as a chip. No client bytes. The versions are in
 * SaveSearchViews.tsx.
 */
export function SaveSearchControl({ query }: { query: BrowseQuery }) {
  const search = matchQueryOf(query);
  const from = browseHref(query);
  return (
    <div className="save-search">
      <Suspense key={searchKey(search)} fallback={<SaveSearchSignedOut from={from} />}>
        <ViewerSaveSearch search={search} from={from} />
      </Suspense>
    </div>
  );
}
