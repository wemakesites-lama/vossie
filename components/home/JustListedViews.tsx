"use client";

import { useState, type ReactNode } from "react";
import { SectionHeader } from "./SectionHeader";

type Scope = "campus" | "all";

type JustListedViewsProps = {
  /** The chosen campus's name, or null when the visitor shops every campus. */
  campusName: string | null;
  campusCount: number;
  /** Both grids come from the server, so switching is instant and the cards stay Server Components (plan decision 2). */
  campusView: ReactNode;
  allView: ReactNode;
  link: { href: string; label: string; context?: string };
};

/** Just listed's heading, the [Campus | All campuses] switch and the grid on show (spec 7.8). */
export function JustListedViews({ campusName, campusCount, campusView, allView, link }: JustListedViewsProps) {
  // Back to the campus view whenever the campus changes. Derived, not keyed: remounting would drop the heading,
  // which has keyboard focus after a choice in Shop by campus.
  const [picked, setPicked] = useState<{ campusName: string | null; scope: Scope }>({
    campusName,
    scope: "campus",
  });
  const scope: Scope = campusName === null ? "all" : picked.campusName === campusName ? picked.scope : "campus";

  function choose(next: Scope) {
    setPicked({ campusName, scope: next });
  }

  function showAllFromEmpty() {
    choose("all");
    // The button goes with the empty state, so focus moves to the heading rather than dropping to the page.
    document.getElementById("just-listed-title")?.focus();
  }

  let body: ReactNode = allView;
  if (scope === "campus") {
    body =
      campusCount > 0 ? (
        campusView
      ) : (
        <div className="just-listed-empty">
          <p className="just-listed-empty-title">Nothing new at {campusName} yet</p>
          <button type="button" onClick={showAllFromEmpty} className="btn btn-primary">
            Show all campuses
          </button>
        </div>
      );
  }

  return (
    <>
      <SectionHeader
        id="just-listed"
        eyebrow="Just listed"
        title={scope === "all" ? "New on all campuses" : `New at ${campusName}`}
        link={link}
      >
        {campusName && (
          <div role="group" aria-label="Show new listings from" className="scope-switch">
            <button
              type="button"
              aria-pressed={scope === "campus"}
              onClick={() => choose("campus")}
              className="scope-switch-campus"
            >
              {campusName}
            </button>
            <button type="button" aria-pressed={scope === "all"} onClick={() => choose("all")}>
              All campuses
            </button>
          </div>
        )}
      </SectionHeader>
      {body}
    </>
  );
}
