"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useRef, useState, type FormEvent, type MouseEvent } from "react";
import { ClockIcon, CloseIcon, SearchIcon, TrendingIcon } from "@/components/icons";
import { useOverlayDialog } from "@/components/ui/useOverlayDialog";
import { useCampusChoice } from "@/hooks/useCampusChoice";
import { ALL_CAMPUSES } from "@/lib/campus";
import { isPlainClick } from "@/lib/click";
import { addRecentSearch, clearRecentSearches, getRecentSearches } from "@/lib/recent-searches";
import type { Campus, Category, TrendingSearches } from "@/lib/types";

type SearchOverlayProps = {
  campuses: readonly Campus[];
  categories: readonly Category[];
  trending: TrendingSearches;
};

const browseHref = (term: string) => `/browse?q=${encodeURIComponent(term)}`;

/** Full-screen search (spec section 6.5). Submitting goes to /browse?q=… */
export function SearchOverlay({ campuses, categories, trending }: SearchOverlayProps) {
  const id = useId();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const trendingHeadingRef = useRef<HTMLHeadingElement>(null);
  const [recent, setRecent] = useState<string[]>([]);
  const choice = useCampusChoice(campuses);
  const { dialogRef, close } = useOverlayDialog("search", () => {
    setRecent(getRecentSearches());
    inputRef.current?.focus();
    inputRef.current?.select(); // a query kept from last time is selected, so typing replaces it
  });

  const campus = choice && choice !== ALL_CAMPUSES ? campuses.find((c) => c.slug === choice) : undefined;
  const campusTerms = campus ? trending[campus.slug] : undefined;
  // The heading names a campus only when that campus has terms of its own; otherwise these are the all-campus terms.
  const trendingCampus = campus && campusTerms?.length ? campus : undefined;
  const trendingTerms = (trendingCampus ? campusTerms : trending.all) ?? [];

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    // After hydration React handles the submit: no full page load. Before it, the plain form still submits to /browse.
    event.preventDefault();
    const term = String(new FormData(event.currentTarget).get("q") ?? "").trim();
    if (!term) return;
    addRecentSearch(term);
    close();
    router.push(browseHref(term));
  }

  /** Following any link closes the overlay and remembers a search-term link, unless the click opens a new tab. */
  function onLinkClick(event: MouseEvent<HTMLDialogElement>) {
    // A click that opens a new tab leaves the overlay open and remembers nothing.
    if (!isPlainClick(event)) return;
    const link = (event.target as HTMLElement).closest("a");
    if (!link) return;
    if (link.dataset.term) addRecentSearch(link.dataset.term);
    close();
  }

  return (
    <dialog ref={dialogRef} aria-label="Search CampusCart" onClick={onLinkClick} className="search-dialog">
      <div className="search-inner">
        <form action="/browse" onSubmit={onSubmit} role="search" className="search-form">
          <label htmlFor={`${id}-q`} className="sr-only">
            Search CampusCart
          </label>
          <SearchIcon className="size-6 shrink-0 text-navy" />
          <input
            ref={inputRef}
            id={`${id}-q`}
            name="q"
            type="search"
            placeholder="Textbooks, tech, braids…"
            autoComplete="off"
            enterKeyHint="search"
            maxLength={100}
            className="search-input"
          />
          <button type="button" onClick={close} aria-label="Close search" className="icon-btn shrink-0">
            <CloseIcon />
          </button>
        </form>

        {recent.length > 0 && (
          <section aria-labelledby={`${id}-recent`} className="search-section">
            <div className="flex items-center justify-between gap-4">
              <h2 id={`${id}-recent`} className="search-heading">
                Recent
              </h2>
              <button
                type="button"
                onClick={() => {
                  clearRecentSearches();
                  setRecent([]);
                  trendingHeadingRef.current?.focus(); // the Clear button is about to unmount
                }}
                className="search-clear"
              >
                Clear
              </button>
            </div>
            <ul className="search-chips">
              {recent.map((term) => (
                <li key={term}>
                  {/* No prefetch: it would send this search to the server as the chip scrolls into view. */}
                  <Link href={browseHref(term)} data-term={term} prefetch={false} className="search-chip">
                    <ClockIcon className="size-4" />
                    {term}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section aria-labelledby={`${id}-trending`} className="search-section">
          <h2 ref={trendingHeadingRef} tabIndex={-1} id={`${id}-trending`} className="search-heading">
            {trendingCampus ? `Trending at ${trendingCampus.name}` : "Trending on CampusCart"}
          </h2>
          <ul className="search-chips">
            {trendingTerms.map((term) => (
              <li key={term}>
                {/* No prefetch either, to save data: nothing is requested until a chip is followed. */}
                <Link href={browseHref(term)} data-term={term} prefetch={false} className="search-chip">
                  <TrendingIcon className="size-4" />
                  {term}
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby={`${id}-categories`} className="search-section">
          <h2 id={`${id}-categories`} className="search-heading">
            Categories
          </h2>
          <ul className="search-categories">
            {categories.map((category) => (
              <li key={category.slug}>
                <Link href={`/browse?cat=${category.slug}`} className="search-category">
                  {category.name}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </dialog>
  );
}
