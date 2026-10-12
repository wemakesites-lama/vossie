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
    <Link href="/saved" aria-label={label} className={cx("icon-btn relative", className)} style={style}>
      <HeartIcon />
      {count > 0 && (
        <span className="hdr-badge" aria-hidden="true">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}
