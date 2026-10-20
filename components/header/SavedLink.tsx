"use client";

import Link from "next/link";
import { HeartIcon } from "@/components/icons";
import { useSavedCount } from "@/hooks/useSavedCount";
import { cx } from "@/lib/cx";

/** "2 items": the count in words, for the header link's name and the tab's description. */
const inWords = (count: number) => `${count} ${count === 1 ? "item" : "items"}`;

/** The count on the heart, capped at 99+, or nothing with nothing saved. A screen reader gets the words instead. */
const badge = (count: number) =>
  count > 0 && (
    <span className="hdr-badge" aria-hidden="true">
      {count > 99 ? "99+" : count}
    </span>
  );

export function SavedLink({ className }: { className?: string }) {
  const count = useSavedCount();
  const label = count === 0 ? "Saved" : `Saved, ${inWords(count)}`;
  return (
    // No prefetch: the header is on every page, and prefetching Saved would download its card chunk (about 0.6 KB) on
    // each one. Saved's list is built per visit anyway, so a prefetch gains little.
    <Link
      href="/saved"
      prefetch={false}
      aria-label={label}
      className={cx("icon-btn relative", className)}
    >
      <HeartIcon />
      {badge(count)}
    </Link>
  );
}

/**
 * The tab bar's Saved count: a badge for the eye, and words that describe the tab ("2 items") without changing its
 * name, as the account badge does. The words (`id`) are always there, empty with nothing saved, so the tab's
 * aria-describedby always points at something. Both are hidden from the name; a description still reads them.
 * The tab bar imports it through SiteHeader.tsx (see there).
 */
export function SavedCount({ id }: { id: string }) {
  const count = useSavedCount();
  return (
    <>
      <span id={id} className="sr-only" aria-hidden="true">
        {count > 0 && inWords(count)}
      </span>
      {badge(count)}
    </>
  );
}
