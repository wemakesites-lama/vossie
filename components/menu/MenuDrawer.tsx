"use client";

import Link from "next/link";
import { useRef, useState, type MouseEvent, type ReactNode } from "react";
import { flushSync } from "react-dom";
import { ArrowLeftIcon, ChevronRightIcon, CloseIcon, MapPinIcon } from "@/components/icons";
import { NavLink } from "@/components/ui/NavLink";
import { useOverlayDialog } from "@/components/ui/useOverlayDialog";
import { useCampusChoice } from "@/hooks/useCampusChoice";
import { useLowData } from "@/hooks/useLowData";
import { campusLabel } from "@/lib/campus";
import { isPlainClick } from "@/lib/click";
import { setLowData } from "@/lib/low-data";
import { openOverlay } from "@/lib/overlays";
import type { Campus, Category } from "@/lib/types";

type View = "main" | "categories" | "campuses";

type MenuDrawerProps = {
  campuses: readonly Campus[];
  categories: readonly Category[];
  /**
   * The account rows, rendered on the server from the session (components/menu/MenuAccount.tsx): "Sign in", or "Your
   * account" and Sign out (accounts spec 3.4).
   */
  account: ReactNode;
};

/** Full-screen navy menu (spec section 6.3) with drill-down views for categories and campuses. */
export function MenuDrawer({ campuses, categories, account }: MenuDrawerProps) {
  const [view, setView] = useState<View>("main");
  const backRef = useRef<HTMLButtonElement>(null);
  const shopDrillRef = useRef<HTMLButtonElement>(null);
  const campusesDrillRef = useRef<HTMLButtonElement>(null);
  const openedByRef = useRef<HTMLElement | null>(null);
  const choice = useCampusChoice(campuses);
  const lowData = useLowData();
  const { dialogRef, close } = useOverlayDialog("menu", (trigger) => {
    openedByRef.current = trigger;
    setView("main");
  });

  /**
   * Change campus: close the menu first, then open the picker. With no modal left open behind it,
   * the picker's confirmation ("Showing Midrand first") is seen and announced (Lama, 2026-10-12).
   * When the picker closes, focus returns to whatever opened the menu.
   */
  function changeCampus() {
    const openedBy = openedByRef.current;
    close();
    openOverlay("campus", openedBy);
  }

  function drillInto(next: Exclude<View, "main">) {
    flushSync(() => setView(next));
    backRef.current?.focus();
  }

  function goBack() {
    const from = view;
    flushSync(() => setView("main"));
    (from === "categories" ? shopDrillRef : campusesDrillRef).current?.focus();
  }

  /**
   * Links navigate in place, so close the menu as soon as one is followed. A click that opens a new tab leaves it open.
   * A form button (Sign out) closes it too, so the toast that follows isn't hidden behind the menu (accounts plan
   * decision 14). The form still posts: closing the dialog doesn't stop the click's submit.
   */
  function closeOnLink(event: MouseEvent<HTMLDialogElement>) {
    if (!isPlainClick(event)) return;
    if ((event.target as HTMLElement).closest("a, [type=submit]")) close();
  }

  return (
    <dialog
      ref={dialogRef}
      aria-label="Menu"
      onClick={closeOnLink}
      className="menu-dialog surface-navy texture-stars"
    >
      <div className="menu-inner">
        <div className="menu-top">
          <button type="button" onClick={close} className="menu-close">
            <CloseIcon />
            <span>Close</span>
          </button>
          <button type="button" aria-haspopup="dialog" onClick={changeCampus} className="menu-campus">
            <MapPinIcon className="size-5 shrink-0" />
            <span className="min-w-0 truncate">
              Shopping at <strong>{campusLabel(choice, campuses)}</strong>
            </span>
            <span className="sr-only">.</span>{" "}
            <span className="menu-campus-change">Change</span>
          </button>
        </div>

        {view === "main" && (
          <nav aria-label="Main" className="menu-view">
            <ul className="menu-links">
              <li className="menu-row">
                <NavLink href="/browse">Shop</NavLink>
                <button
                  ref={shopDrillRef}
                  type="button"
                  aria-label="Shop by category"
                  onClick={() => drillInto("categories")}
                  className="menu-drill"
                >
                  <ChevronRightIcon />
                </button>
              </li>
              <li>
                <NavLink href="/sell">Sell</NavLink>
              </li>
              <li>
                <button
                  ref={campusesDrillRef}
                  type="button"
                  onClick={() => drillInto("campuses")}
                  className="menu-link-button"
                >
                  Campuses
                  <ChevronRightIcon className="menu-inline-arrow" />
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
              {account}
            </ul>
          </nav>
        )}

        {view === "categories" && (
          <section aria-labelledby="menu-categories-title" className="menu-view menu-view-drill">
            <button ref={backRef} type="button" onClick={goBack} className="menu-back">
              <ArrowLeftIcon />
              Back
            </button>
            <h2 id="menu-categories-title" className="menu-drill-title">
              Shop by category
            </h2>
            <ul className="menu-sublinks">
              <li>
                <Link href="/browse">Everything</Link>
              </li>
              {categories.map((category) => (
                <li key={category.slug}>
                  <Link href={`/browse?cat=${category.slug}`}>{category.name}</Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {view === "campuses" && (
          <section aria-labelledby="menu-campuses-title" className="menu-view menu-view-drill">
            <button ref={backRef} type="button" onClick={goBack} className="menu-back">
              <ArrowLeftIcon />
              Back
            </button>
            <h2 id="menu-campuses-title" className="menu-drill-title">
              Campuses
            </h2>
            <ul className="menu-sublinks">
              <li>
                <Link href="/browse?campus=all">All campuses</Link>
              </li>
              {campuses.map((campus) => (
                <li key={campus.slug}>
                  <Link href={`/browse?campus=${campus.slug}`}>
                    {campus.name}
                    <span className="sr-only">,</span>{" "}
                    <span className="menu-sublink-detail">{campus.region}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="menu-bottom">
          <button
            type="button"
            role="switch"
            aria-checked={lowData}
            aria-describedby="menu-low-data-note"
            onClick={() => setLowData(!lowData)}
            className="menu-switch"
          >
            <span>Data saver</span>
            <span className="menu-switch-track" aria-hidden="true">
              <span className="menu-switch-thumb" />
            </span>
          </button>
          <p id="menu-low-data-note" className="text-meta text-white/75">
            Pauses autoplay and animation, and loads lighter photos.
          </p>
        </div>
      </div>
    </dialog>
  );
}
