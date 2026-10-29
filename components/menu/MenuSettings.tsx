"use client";

import { useLowData } from "@/hooks/useLowData";
import { setLowData } from "@/lib/low-data";
import { ThemeChoice } from "./ThemeChoice";

/**
 * The menu's settings, Theme and Data saver. MenuDrawer loads this file when the menu first opens: on every page, the
 * Theme choice's bytes tipped the listing forms over 150 KB, and Data saver came along to pay for the loading
 * (Dark and Night themes spec 3.3).
 */
export default function MenuSettings() {
  const lowData = useLowData();
  return (
    <>
      <ThemeChoice />
      <div className="menu-low-data">
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
        <p id="menu-low-data-note" className="text-meta text-on-band/75">
          Pauses autoplay and animation, and loads lighter photos.
        </p>
      </div>
    </>
  );
}
