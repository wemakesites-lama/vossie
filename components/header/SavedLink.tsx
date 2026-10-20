"use client";

import Link from "next/link";
import type { CSSProperties } from "react";
import { HeartIcon } from "@/components/icons";
import { useSavedCount } from "@/hooks/useSavedCount";
import { cx } from "@/lib/cx";

export function SavedLink({ className, style }: { className?: string; style?: CSSProperties }) {
  const count = useSavedCount();
  const label = count === 0 ? "Saved" : `Saved, ${count} ${count === 1 ? "item" : "items"}`;
  return (
    // No prefetch: the header is on every page, and prefetching Saved would download its card chunk (about 0.6 KB) on
    // each one. Saved's list is built per visit anyway, so a prefetch gains little.
    <Link
      href="/saved"
      prefetch={false}
      aria-label={label}
      className={cx("icon-btn relative", className)}
      style={style}
    >
      <HeartIcon />
      {count > 0 && (
        <span className="hdr-badge" aria-hidden="true">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}

/** The id of the words that describe the tab bar's Saved tab. */
export const SAVED_COUNT_ID = "tab-saved-count";

/**
 * The tab bar's Saved count: a badge for the eye, and words that describe the tab ("2 items") without changing its
 * name, as the account badge does. The words are always there (empty with nothing saved), so the tab's
 * aria-describedby always points at something. Both are hidden from the name; a description still reads them.
 */
export function SavedCount() {
  const count = useSavedCount();
  return (
    <>
      <span id={SAVED_COUNT_ID} className="sr-only" aria-hidden="true">
        {count > 0 ? `${count} ${count === 1 ? "item" : "items"}` : ""}
      </span>
      {count > 0 && (
        <span className="hdr-badge" aria-hidden="true">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </>
  );
}
