import type { BrowseQuery } from "@/lib/types";
import { PAGE_SIZE, defaultSort } from "./query";

export type BrowseChanges = Partial<Omit<BrowseQuery, "campusFromLink">>;

/**
 * A browse link (browse and listing spec 3.3): the query with `changes` applied, the parameters in a fixed order, and
 * defaults left out, so links stay short and the same results share one link.
 * - The campus is written only when it came from the link or is being changed, so a link never pins a campus the
 *   viewer didn't ask for.
 * - Any change other than `shown` starts the results from the top again.
 */
export function browseHref(query: BrowseQuery, changes: BrowseChanges = {}): string {
  const next = { ...query, ...changes };
  const writeCampus = query.campusFromLink || "campus" in changes;
  const keepShown = "shown" in changes || Object.keys(changes).length === 0;
  const sort = next.sort === "match" && !next.q ? "new" : next.sort;

  const params = new URLSearchParams();
  if (next.q) params.set("q", next.q);
  if (next.category) params.set("cat", next.category);
  if (writeCampus) params.set("campus", next.campus);
  if (next.price) params.set("price", next.price);
  if (next.pay) params.set("pay", next.pay);
  if (next.deals) params.set("deals", next.deals);
  if (sort !== defaultSort(next.q)) params.set("sort", sort);
  if (keepShown && next.shown !== PAGE_SIZE) params.set("n", String(next.shown));

  const search = params.toString();
  return search ? `/browse?${search}` : "/browse";
}
