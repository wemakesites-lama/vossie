"use client";

import { ShareIcon } from "@/components/icons";
import { cx } from "@/lib/cx";
import { shareLink } from "@/lib/share";
import { showToast } from "@/lib/toast";

/**
 * Share (spec 5.8): the share sheet, or a copied link with a toast to say so. It shares the listing's own address,
 * without a "?retry=" or a "#" section from the current URL. `className` places it: the listing page's navy outline by
 * default, or the storefront's white one on navy.
 */
export function ShareButton({ title, className = "listing-share" }: { title: string; className?: string }) {
  async function onClick() {
    const outcome = await shareLink(title, window.location.origin + window.location.pathname);
    if (outcome === "copied") showToast("Link copied");
    if (outcome === "failed") showToast("Couldn't share. Copy the link from your address bar.");
  }

  return (
    <button type="button" onClick={onClick} aria-label="Share" className={cx("icon-btn", className)}>
      <ShareIcon className="size-5" />
    </button>
  );
}
