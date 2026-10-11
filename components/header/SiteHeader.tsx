"use client";

import Link from "next/link";
import { useRef, type CSSProperties, type MouseEvent } from "react";
import { flushSync } from "react-dom";
import { Pennant } from "@/components/brand/Pennant";
import { MenuIcon, SearchIcon, UserIcon } from "@/components/icons";
import { NavLink } from "@/components/ui/NavLink";
import { isMotionAllowedNow } from "@/hooks/useMotionAllowed";
import { openOverlay } from "@/lib/overlays";
import type { Campus } from "@/lib/types";
import { CampusPill } from "./CampusPill";
import { SavedLink } from "./SavedLink";
import { useHeaderMode } from "./useHeaderMode";

/** Reveal stagger: each item fades in 40ms after the one before (spec section 6.2). */
const stagger = (index: number) => ({ "--i": index }) as CSSProperties;

export function SiteHeader({ campuses }: { campuses: readonly Campus[] }) {
  const headerRef = useRef<HTMLElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const { mode, reveal } = useHeaderMode(headerRef);
  const hidden = mode === "crest";

  function showNavigation() {
    flushSync(() => reveal());
    menuButtonRef.current?.focus();
  }

  function goHome(event: MouseEvent<HTMLAnchorElement>) {
    if (window.location.pathname !== "/") return;
    event.preventDefault();
    window.scrollTo({ top: 0, behavior: isMotionAllowedNow() ? "smooth" : "auto" });
  }

  return (
    <header ref={headerRef} data-mode={mode} className="site-header">
      <nav aria-label="Quick links" className="hdr-quick" inert={hidden}>
        <ul>
          <li>
            <NavLink href="/browse">Shop</NavLink>
          </li>
          <li>
            <NavLink href="/sell">Sell</NavLink>
          </li>
          <li>
            <button type="button" aria-haspopup="dialog" onClick={(event) => openOverlay("campus", event.currentTarget)}>
              Campuses
            </button>
          </li>
          <li>
            <NavLink href="/hub">Hub</NavLink>
          </li>
          <li>
            <NavLink href="/how-it-works">How it works</NavLink>
          </li>
          <li>
            <NavLink href="/safety">Safety</NavLink>
          </li>
        </ul>
      </nav>

      <div className="hdr-bar">
        <div className="hdr-bar-bg" aria-hidden="true" />
        <div className="hdr-bar-inner">
          <div className="hdr-group" inert={hidden}>
            <button
              ref={menuButtonRef}
              type="button"
              aria-haspopup="dialog"
              onClick={(event) => openOverlay("menu", event.currentTarget)}
              className="hdr-item hdr-menu-btn"
              style={stagger(0)}
            >
              <MenuIcon />
              <span className="sr-only wide:not-sr-only">Menu</span>
            </button>
            <button
              type="button"
              aria-label="Search"
              aria-haspopup="dialog"
              onClick={(event) => openOverlay("search", event.currentTarget)}
              className="hdr-item hdr-icon-btn wide:hidden"
              style={stagger(1)}
            >
              <SearchIcon />
            </button>
            <CampusPill campuses={campuses} className="hdr-item hidden wide:inline-flex" style={stagger(1)} />
          </div>

          <div className="hdr-pennant-slot">
            {hidden ? (
              <button
                type="button"
                aria-label="Show navigation"
                aria-expanded={false}
                onClick={showNavigation}
                className="hdr-pennant"
              >
                <Pennant />
              </button>
            ) : (
              <Link href="/" aria-label="Vossie home" onClick={goHome} className="hdr-pennant">
                <Pennant />
              </Link>
            )}
          </div>

          <div className="hdr-group hdr-group--end" inert={hidden}>
            <button
              type="button"
              aria-label="Search"
              aria-haspopup="dialog"
              onClick={(event) => openOverlay("search", event.currentTarget)}
              className="hdr-item hdr-icon-btn hidden wide:inline-grid"
              style={stagger(2)}
            >
              <SearchIcon />
            </button>
            <Link href="/account" aria-label="Account" className="hdr-item hdr-icon-btn" style={stagger(3)}>
              <UserIcon />
            </Link>
            <SavedLink className="hdr-item" style={stagger(4)} />
          </div>
        </div>
      </div>
    </header>
  );
}
