"use client";

import { useEffect } from "react";

// Show more is always a full page load, which resets this. Back brings a hidden browse page back and runs its effects
// again, and that visit must not be pulled to a card.
let handled = false;

/**
 * Show more is a full page load to #r-25 (plan decision 4). The results stream in, and the browser sometimes runs its
 * one fragment scroll before the streamed card is in place, leaving the page at the top, and it doesn't move the
 * keyboard's starting point to a card that wasn't there yet. Once the page is running, this finishes the job: it focuses
 * the named card's link, so a keyboard user carries on from the first new card (spec 4.6), without scrolling; then, if
 * the card is off screen, it scrolls it into view (the page's scroll margin keeps it clear of the header). It runs once
 * per page load, so coming back to the page with Back does nothing.
 */
export function ScrollToResult() {
  useEffect(() => {
    if (handled) return;
    handled = true;
    const id = window.location.hash.slice(1);
    if (!/^r-\d+$/.test(id)) return;
    const target = document.getElementById(id);
    if (!target) return;
    target.querySelector("a")?.focus({ preventScroll: true });
    const { top, bottom } = target.getBoundingClientRect();
    if (bottom <= 0 || top >= window.innerHeight) target.scrollIntoView({ block: "start" });
  }, []);
  return null;
}
