import Link from "next/link";
import { ALL_CAMPUSES } from "@/lib/campus";
import { clearFiltersHref } from "@/lib/browse/filters";
import { browseHref } from "@/lib/browse/href";
import type { BrowseQuery } from "@/lib/types";

/** Nothing matches (spec 4.7). The tabs, toolbar and chips stay above it, so the viewer can change course. */
export function BrowseEmpty({ query, elsewhere }: { query: BrowseQuery; elsewhere: number }) {
  const filtered = Boolean(query.price || query.pay || query.deals);
  return (
    <section aria-labelledby="empty-title" className="browse-empty">
      <h2 id="empty-title" className="browse-empty-title">
        Nothing here yet
      </h2>
      {query.q && <p>Check the spelling, or try a shorter word.</p>}
      {query.campus !== ALL_CAMPUSES && elsewhere > 0 && (
        <p>
          <Link href={browseHref(query, { campus: ALL_CAMPUSES })} prefetch={false}>
            {elsewhere === 1 ? "1 more at another campus" : `${elsewhere} more at other campuses`}
          </Link>
        </p>
      )}
      {filtered && (
        <p>
          <Link href={clearFiltersHref(query)} prefetch={false}>
            Clear filters
          </Link>
        </p>
      )}
      <p>
        Can&apos;t find it? <Link href="/looking-for">Ask for it on Looking For</Link>
      </p>
    </section>
  );
}
