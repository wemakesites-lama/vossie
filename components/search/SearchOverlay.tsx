"use client";

import Form from "next/form";
import Link from "next/link";
import { useId, useRef, useState, type FormEvent, type MouseEvent } from "react";
import { ClockIcon, CloseIcon, SearchIcon, TrendingIcon } from "@/components/icons";
import { useOverlayDialog } from "@/components/ui/useOverlayDialog";
import { useCampusChoice } from "@/hooks/useCampusChoice";
import { ALL_CAMPUSES } from "@/lib/campus";
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
  const inputRef = useRef<HTMLInputElement>(null);
  const [recent, setRecent] = useState<string[]>([]);
  const choice = useCampusChoice(campuses);
  const { dialogRef, close } = useOverlayDialog("search", () => {
    setRecent(getRecentSearches());
    inputRef.current?.focus();
  });

  const campus = choice && choice !== ALL_CAMPUSES ? campuses.find((c) => c.slug === choice) : undefined;
  const trendingTerms = (campus && trending[campus.slug]) || trending.all || [];

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    const term = String(new FormData(event.currentTarget).get("q") ?? "").trim();
    if (!term) {
      event.preventDefault();
      return;
    }
    addRecentSearch(term);
    close();
  }

  /** Following any link closes the overlay; search-term links are remembered too. */
  function onLinkClick(event: MouseEvent<HTMLDialogElement>) {
    const link = (event.target as HTMLElement).closest("a");
    if (!link) return;
    if (link.dataset.term) addRecentSearch(link.dataset.term);
    close();
  }

  return (
    <dialog ref={dialogRef} aria-label="Search Vossie" onClick={onLinkClick} className="search-dialog">
      <div className="search-inner">
        <Form action="/browse" onSubmit={onSubmit} role="search" className="search-form">
          <label htmlFor={`${id}-q`} className="sr-only">
            Search Vossie
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
            className="search-input"
          />
          <button type="button" onClick={close} aria-label="Close search" className="hdr-icon-btn shrink-0">
            <CloseIcon />
          </button>
        </Form>

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
                }}
                className="search-clear"
              >
                Clear
              </button>
            </div>
            <ul className="search-chips">
              {recent.map((term) => (
                <li key={term}>
                  <Link href={browseHref(term)} data-term={term} className="search-chip">
                    <ClockIcon className="size-4" />
                    {term}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section aria-labelledby={`${id}-trending`} className="search-section">
          <h2 id={`${id}-trending`} className="search-heading">
            {campus ? `Trending at ${campus.name}` : "Trending on Vossie"}
          </h2>
          <ul className="search-chips">
            {trendingTerms.map((term) => (
              <li key={term}>
                <Link href={browseHref(term)} data-term={term} className="search-chip">
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
                <Link href={`/categories/${category.slug}`} className="search-category">
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
