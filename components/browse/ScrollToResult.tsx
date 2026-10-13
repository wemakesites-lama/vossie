"use client";

import { useEffect } from "react";

/**
 * Show more is a full page load to #r-25 (plan decision 4). The results stream in, and Chrome sometimes runs its one
 * fragment scroll before the streamed card is in place, leaving the page at the top. Once the page is running, this
 * finishes the job: if the card the link points at is off screen, it's scrolled into view (the page's scroll margin
 * keeps it clear of the header).
 */
export function ScrollToResult() {
  useEffect(() => {
    const id = window.location.hash.slice(1);
    if (!/^r-\d+$/.test(id)) return;
    const target = document.getElementById(id);
    if (!target) return;
    const { top, bottom } = target.getBoundingClientRect();
    if (bottom <= 0 || top >= window.innerHeight) target.scrollIntoView({ block: "start" });
  }, []);
  return null;
}
