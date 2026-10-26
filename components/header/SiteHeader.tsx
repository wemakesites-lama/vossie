"use client";

import Link from "next/link";
import { useRef, type MouseEvent, type ReactNode } from "react";
import { flushSync } from "react-dom";
import { Pennant } from "@/components/brand/Pennant";
import { MenuIcon, SearchIcon } from "@/components/icons";
import { NavLink } from "@/components/ui/NavLink";
import { isMotionAllowedNow } from "@/hooks/useMotionAllowed";
import { isPlainClick } from "@/lib/click";
import { TAB } from "@/lib/motion";
import { openOverlay } from "@/lib/overlays";
import type { Campus } from "@/lib/types";
import { CampusPill } from "./CampusPill";
import { SavedLink } from "./SavedLink";

/**
 * The tab bar's Saved count, re-exported so the tab bar (a server component) reaches it through this module, which the
 * layout already loads. Imported from SavedLink.tsx directly, it became a client entry of its own, and Turbopack split
 * the merged layout chunk (decision 63) in two: about 600 B more on every page's first visit.
 */
export { SavedCount, SavedLink } from "./SavedLink";
import { useHeaderMode } from "./useHeaderMode";

type SiteHeaderProps = {
  campuses: readonly Campus[];
  /**
   * The account icon, rendered on the server from the session (components/header/AccountLink.tsx), so the header
   * knows who's signed in without client code (accounts plan decision 1).
   */
  account: ReactNode;
  /** Saved's heart on phones for sellers and staff (components/header/PhoneSaved.tsx), streamed like the account icon. */
  phoneSaved: ReactNode;
};

export function SiteHeader({ campuses, account, phoneSaved }: SiteHeaderProps) {
  const headerRef = useRef<HTMLElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const { mode, show } = useHeaderMode(headerRef);
  const hidden = mode === "hidden";

  function showNavigation() {
    flushSync(() => show());
    menuButtonRef.current?.focus({ preventScroll: true });
  }

  function goHome(event: MouseEvent<HTMLAnchorElement>) {
    // Let modified clicks (new tab, new window) behave as usual.
    if (!isPlainClick(event)) return;
    if (window.location.pathname !== "/") return;
    event.preventDefault();
    window.scrollTo({ top: 0, behavior: isMotionAllowedNow() ? "smooth" : "auto" });
  }

  return (
    <header ref={headerRef} data-mode={mode} className="site-header">
      {/* Hidden, the header can't take focus, so keyboard and screen-reader users get this instead: unseen until
          focused, like the skip link (spec section 6.2). Scrolling up does the same for everyone else. */}
      {hidden && (
        <button type="button" aria-expanded={false} onClick={showNavigation} className="hdr-show">
          Show navigation
        </button>
      )}

      <nav aria-label="Quick links" className="hdr-quick" inert={hidden}>
        <ul>
          <li>
            <NavLink href="/browse" transitionTypes={TAB}>Shop</NavLink>
          </li>
          <li>
            <NavLink href="/sell" transitionTypes={TAB}>Sell</NavLink>
          </li>
          <li>
            <button type="button" aria-haspopup="dialog" onClick={(event) => openOverlay("campus", event.currentTarget)}>
              Campuses
            </button>
          </li>
          <li>
            <NavLink href="/hub" transitionTypes={TAB}>Launchpad</NavLink>
          </li>
          <li>
            <NavLink href="/looking-for" transitionTypes={TAB} prefetch={false}>
              Looking For
            </NavLink>
          </li>
          <li>
            <NavLink href="/how-it-works" transitionTypes={TAB}>How it works</NavLink>
          </li>
          <li>
            <NavLink href="/safety" transitionTypes={TAB}>Safety</NavLink>
          </li>
        </ul>
      </nav>

      <div className="hdr-bar" inert={hidden}>
        <div className="hdr-bar-bg" aria-hidden="true" />
        <div className="hdr-bar-inner">
          <div className="hdr-group">
            <button
              ref={menuButtonRef}
              type="button"
              aria-haspopup="dialog"
              onClick={(event) => openOverlay("menu", event.currentTarget)}
              className="hdr-item hdr-menu-btn"
            >
              <MenuIcon />
              <span className="sr-only wide:not-sr-only">Menu</span>
            </button>
            <CampusPill campuses={campuses} className="hdr-item hidden wide:inline-flex" />
          </div>

          <div className="hdr-pennant-slot">
            {/* The link on top carries the name and the focus ring, sized to cover the pennant's white edge. */}
            <Pennant />
            <Link href="/" aria-label="CampusCart home" onClick={goHome} className="hdr-pennant" />
          </div>

          <div className="hdr-group hdr-group--end">
            {/* Before Search: the group is end-aligned, so a heart streaming in moves nothing already on screen. */}
            {phoneSaved}
            <button
              type="button"
              aria-label="Search"
              aria-haspopup="dialog"
              onClick={(event) => openOverlay("search", event.currentTarget)}
              className="hdr-item icon-btn"
            >
              <SearchIcon />
            </button>
            {/* Phones have Account in the tab bar (components/tabbar/TabBar.tsx), and Saved too unless the bar is a
                seller's or staff's (role bars spec 6), so the header keeps Menu, the pennant and Search there. */}
            {account}
            <SavedLink className="hdr-item hidden wide:inline-grid" />
          </div>
        </div>
      </div>
    </header>
  );
}
