"use client";

import { useId, useRef, useState } from "react";
import { CheckIcon, CloseIcon } from "@/components/icons";
import { useOverlayDialog } from "@/components/ui/useOverlayDialog";
import { useCampusChoice } from "@/hooks/useCampusChoice";
import { ALL_CAMPUSES, setCampusChoice } from "@/lib/campus";
import { showToast } from "@/lib/toast";
import type { Campus, CampusChoice } from "@/lib/types";
import { useSheetDrag } from "./useSheetDrag";

const DESKTOP_QUERY = "(min-width: 48rem) and (min-height: 30rem)";
const POPOVER_WIDTH = 380;
const EDGE = 16;

/** Campus picker (spec section 6.4): a popover under its trigger on larger screens, a bottom sheet on phones. */
export function CampusPicker({ campuses }: { campuses: readonly Campus[] }) {
  const titleId = useId();
  const searchId = useId();
  const searchRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const choice = useCampusChoice(campuses);

  const { dialogRef, close, onBackdropClick } = useOverlayDialog("campus", (trigger, dialog) => {
    setQuery("");
    if (!window.matchMedia(DESKTOP_QUERY).matches) return;
    if (trigger) {
      const rect = trigger.getBoundingClientRect();
      const maxHeight = Math.min(560, window.innerHeight * 0.7);
      const top = Math.max(EDGE, Math.min(rect.bottom + 8, window.innerHeight - maxHeight - EDGE));
      const left = Math.max(EDGE, Math.min(rect.left, window.innerWidth - POPOVER_WIDTH - EDGE));
      dialog.style.setProperty("--picker-top", `${Math.round(top)}px`);
      dialog.style.setProperty("--picker-left", `${Math.round(left)}px`);
    } else {
      dialog.style.removeProperty("--picker-top");
      dialog.style.removeProperty("--picker-left");
    }
    searchRef.current?.focus();
  });
  const drag = useSheetDrag(dialogRef, close);

  const term = query.trim().toLowerCase();
  const matches = term
    ? campuses.filter((campus) => `${campus.name} ${campus.region}`.toLowerCase().includes(term))
    : campuses;

  function choose(next: CampusChoice) {
    setCampusChoice(next);
    close();
    const name = campuses.find((campus) => campus.slug === next)?.name;
    showToast(name ? `Showing ${name} first` : "Showing all campuses");
  }

  return (
    <dialog ref={dialogRef} aria-labelledby={titleId} onClick={onBackdropClick} className="sheet-dialog">
      <div className="sheet-inner">
        <div className="sheet-handle" aria-hidden="true" {...drag}>
          <span />
        </div>
        <div className="flex items-center justify-between gap-3">
          <h2 id={titleId} className="font-display text-[1.75rem] uppercase leading-none text-navy">
            Choose your campus
          </h2>
          <button type="button" onClick={close} aria-label="Close" className="hdr-icon-btn -mr-2">
            <CloseIcon />
          </button>
        </div>
        <p className="mt-1 text-meta text-muted">Your campus shows first. You can still shop every campus.</p>
        <label htmlFor={searchId} className="sr-only">
          Find your campus
        </label>
        <input
          ref={searchRef}
          id={searchId}
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Find your campus"
          autoComplete="off"
          enterKeyHint="search"
          className="picker-search"
        />
        <ul className="picker-list">
          <li>
            <CampusOption
              label="All campuses"
              detail="Shop every campus"
              current={choice === ALL_CAMPUSES}
              onChoose={() => choose(ALL_CAMPUSES)}
            />
          </li>
          {matches.map((campus) => (
            <li key={campus.slug}>
              <CampusOption
                label={campus.name}
                detail={campus.region}
                current={choice === campus.slug}
                onChoose={() => choose(campus.slug)}
              />
            </li>
          ))}
        </ul>
        {matches.length === 0 && (
          <p role="status" className="px-3 py-4 text-muted">
            No campus matches “{query.trim()}”.
          </p>
        )}
      </div>
    </dialog>
  );
}

type CampusOptionProps = {
  label: string;
  detail: string;
  current: boolean;
  onChoose: () => void;
};

function CampusOption({ label, detail, current, onChoose }: CampusOptionProps) {
  // Chromium puts a space between the blockified flex children ("Midrand , Gauteng"), so the label fixes the name.
  return (
    <button
      type="button"
      onClick={onChoose}
      aria-current={current ? "true" : undefined}
      aria-label={`${label}, ${detail}`}
      className="picker-option"
    >
      <span className="flex min-w-0 flex-col items-start">
        <span className="font-semibold text-navy">{label}</span>
        <span className="text-meta text-muted">{detail}</span>
      </span>
      {current && <CheckIcon className="size-5 shrink-0 text-sky-dark" />}
    </button>
  );
}
