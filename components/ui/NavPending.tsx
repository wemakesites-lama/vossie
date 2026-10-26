"use client";

import { useLinkStatus } from "next/link";
import { useEffect } from "react";

/** The window event that asks the header to come back while a tapped link waits (useHeaderMode answers it). */
export const NAV_PENDING_EVENT = "vossie:navpending";

// Links waiting at once. Next shows only the last tapped link as pending, but a quick second tap can overlap the
// first's cleanup, so <html> stays marked until both are done.
let pending = 0;

/**
 * Renders nothing. Inside a <Link>, it marks <html data-nav-pending> while that link waits for the server, so the header
 * crest breathes (calm navigation spec 4, layer 4), and asks the header back if scrolling hid it. Only links that
 * weren't prefetched are ever pending.
 */
export function NavPending() {
  const { pending: waiting } = useLinkStatus();
  useEffect(() => {
    if (!waiting) return;
    pending += 1;
    document.documentElement.setAttribute("data-nav-pending", "");
    window.dispatchEvent(new Event(NAV_PENDING_EVENT));
    return () => {
      pending -= 1;
      if (pending === 0) document.documentElement.removeAttribute("data-nav-pending");
    };
  }, [waiting]);
  return null;
}
