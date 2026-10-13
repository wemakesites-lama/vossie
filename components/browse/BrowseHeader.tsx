import { SearchIcon } from "@/components/icons";
import { browseHeading } from "@/lib/browse/heading";
import type { BrowseQuery } from "@/lib/types";

/** The browse page's eyebrow, h1 and search field (spec 4.1 and 4.2). */
export function BrowseHeader({ query, categoryName }: { query: BrowseQuery; categoryName: string | null }) {
  const { eyebrow, heading } = browseHeading(query.q, categoryName);
  return (
    <div className="browse-head">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="browse-title">{heading}</h1>
      </div>
      <BrowseSearch query={query} />
    </div>
  );
}

/**
 * A plain GET form, so it works before (or without) the app's JavaScript. A new search keeps the category and filters, and the
 * campus when the link named one; it drops the sort and paging, so it starts at Best match from the top.
 */
function BrowseSearch({ query }: { query: BrowseQuery }) {
  const kept: ReadonlyArray<[name: string, value: string | null]> = [
    ["cat", query.category],
    ["campus", query.campusFromLink ? query.campus : null],
    ["price", query.price],
    ["pay", query.pay],
    ["deals", query.deals],
  ];
  return (
    <form action="/browse" role="search" className="browse-search">
      <label htmlFor="browse-q" className="sr-only">
        Search Vossie
      </label>
      <input
        id="browse-q"
        type="search"
        name="q"
        defaultValue={query.q ?? ""}
        placeholder="Search Vossie"
        autoComplete="off"
        enterKeyHint="search"
        className="browse-search-input"
      />
      {kept.map(([name, value]) => value && <input key={name} type="hidden" name={name} value={value} />)}
      <button type="submit" aria-label="Search" className="icon-btn">
        <SearchIcon className="size-5" />
      </button>
    </form>
  );
}
