"use client";

import { useEffect, useState, useSyncExternalStore, type FocusEvent, type PointerEvent } from "react";
import { CheckIcon, PauseIcon, PlayIcon } from "@/components/icons";
import { useCampusChoice } from "@/hooks/useCampusChoice";
import { useChooseCampus } from "@/hooks/useChooseCampus";
import { isMotionAllowedNow, useMotionAllowed } from "@/hooks/useMotionAllowed";
import { usePageHidden } from "@/hooks/usePageHidden";
import { WIDE_QUERY } from "@/lib/breakpoints";
import { ALL_CAMPUSES, isOnlineCampus } from "@/lib/campus";
import { cx } from "@/lib/cx";
import type { Campus, CampusChoice } from "@/lib/types";
import { Carousel } from "./Carousel";
import { Photo } from "./Photo";

const CYCLE_MS = 4000;

// The cycle only runs where it shows: the tablet and desktop layout.
function subscribeWide(listener: () => void) {
  const query = window.matchMedia(WIDE_QUERY);
  query.addEventListener("change", listener);
  return () => query.removeEventListener("change", listener);
}
const isWide = () => window.matchMedia(WIDE_QUERY).matches;
const narrowOnServer = () => false;

/** Shop by campus (spec 7.7): campus names round one photo from the tablet step, a card carousel on phones. */
export function CampusChooser({ campuses }: { campuses: readonly Campus[] }) {
  const choice = useCampusChoice(campuses);
  const chooseCampus = useChooseCampus(campuses);
  const motionAllowed = useMotionAllowed();
  const wide = useSyncExternalStore(subscribeWide, isWide, narrowOnServer);
  const pageHidden = usePageHidden();
  const [step, setStep] = useState(0);
  const [paused, setPaused] = useState(false);
  // Two holds, as in the hero: a mouse over the layout, and keyboard focus inside it.
  const [mouseOver, setMouseOver] = useState(false);
  const [focusInside, setFocusInside] = useState(false);

  const physical = campuses.filter((campus) => !isOnlineCampus(campus));
  const online = campuses.find(isOnlineCampus);
  // Until the cookie has been read (server render and hydration), behave as "all campuses".
  const allChosen = choice === null || choice === ALL_CAMPUSES;
  const canCycle = allChosen && motionAllowed && wide && physical.length > 1;
  const cycling = canCycle && !paused && !mouseOver && !focusInside && !pageHidden;

  useEffect(() => {
    if (!cycling) return;
    const timer = window.setInterval(() => setStep((current) => (current + 1) % physical.length), CYCLE_MS);
    return () => window.clearInterval(timer);
  }, [cycling, physical.length]);

  const near = (offset: number) => physical[(step + offset + physical.length) % physical.length];
  const highlighted = allChosen ? near(0) : (campuses.find((campus) => campus.slug === choice) ?? near(0));
  // Only the photo on show and its neighbours mount: the one fading out, and the next one, so it's ready in time.
  const mounted = new Set([highlighted.slug, ...(canCycle ? [near(-1).slug, near(1).slug] : [])]);

  function choose(next: CampusChoice) {
    setPaused(true);
    chooseCampus(next);
    // Show what changed: Just listed, with keyboard focus on its heading (plan decision 5).
    document.getElementById("just-listed-title")?.focus({ preventScroll: true });
    document
      .getElementById("just-listed")
      ?.scrollIntoView({ behavior: isMotionAllowedNow() ? "smooth" : "auto", block: "start" });
  }

  const onPointerEnter = (event: PointerEvent<HTMLElement>) => {
    if (event.pointerType === "mouse") setMouseOver(true);
  };
  const onPointerLeave = (event: PointerEvent<HTMLElement>) => {
    if (event.pointerType === "mouse") setMouseOver(false);
  };
  // Focus on a campus name holds the highlight, so it doesn't move under the keyboard. The Pause/Play button never
  // goes inert, so focus there doesn't hold: Play has to work while it has focus (as in the hero).
  const onFocus = (event: FocusEvent<HTMLElement>) => {
    setFocusInside(!(event.target as Element).closest(".campus-toggle"));
  };
  const onBlur = (event: FocusEvent<HTMLElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocusInside(false);
  };

  const half = Math.ceil(physical.length / 2);
  const nameButton = (campus: Campus) => (
    <li key={campus.slug}>
      <button
        type="button"
        onClick={() => choose(campus.slug)}
        aria-current={choice === campus.slug ? "true" : undefined}
        className={cx("campus-name", campus.slug === highlighted.slug && "campus-name-on")}
      >
        {campus.name}
        {/* Spaces sit outside the hidden spans: name computation trims each element's own text. */}
        <span className="sr-only">,</span>{" "}
        <span className="campus-count">
          {campus.liveListings} <span className="sr-only">live listings</span>
        </span>
      </button>
    </li>
  );

  return (
    <>
      <div
        className="campus-chooser-wide"
        onPointerEnter={onPointerEnter}
        onPointerLeave={onPointerLeave}
        onFocus={onFocus}
        onBlur={onBlur}
      >
        <ul className="campus-names campus-names-start">{physical.slice(0, half).map(nameButton)}</ul>
        <div className="campus-photo-box">
          <div aria-hidden="true">
            {campuses.map((campus) =>
              mounted.has(campus.slug) ? (
                <div
                  key={campus.slug}
                  className={cx("campus-photo", campus.slug === highlighted.slug && "campus-photo-active")}
                >
                  <Photo image={{ src: campus.image.src, alt: "" }} sizes="300px" className="campus-photo-img" />
                </div>
              ) : null,
            )}
            {canCycle && (
              // A new key restarts the bar's 4-second fill at each step.
              <span key={step} className="campus-progress" data-running={cycling ? "" : undefined} />
            )}
          </div>
          {canCycle && (
            <button
              type="button"
              onClick={() => setPaused(!paused)}
              aria-label={paused ? "Play campus highlights" : "Pause campus highlights"}
              className="campus-toggle"
            >
              {paused ? <PlayIcon className="size-5" /> : <PauseIcon className="size-5" />}
            </button>
          )}
        </div>
        <ul className="campus-names campus-names-end">{physical.slice(half).map(nameButton)}</ul>
        <div className="campus-chooser-foot">
          <button
            type="button"
            onClick={() => choose(ALL_CAMPUSES)}
            aria-current={choice === ALL_CAMPUSES ? "true" : undefined}
            className={cx("campus-choice", allChosen && "campus-choice-on")}
          >
            All campuses
          </button>
          {online && (
            <button
              type="button"
              onClick={() => choose(online.slug)}
              aria-current={choice === online.slug ? "true" : undefined}
              className={cx("campus-choice", choice === online.slug && "campus-choice-on")}
            >
              {online.name}
            </button>
          )}
        </div>
        <p className="campus-caption">Small numbers show live listings.</p>
      </div>

      <Carousel label="Campuses" className="campus-cards">
        <li>
          <button
            type="button"
            onClick={() => choose(ALL_CAMPUSES)}
            aria-current={choice === ALL_CAMPUSES ? "true" : undefined}
            className={cx("campus-card campus-card-all surface-navy texture-stars", choice === ALL_CAMPUSES && "campus-card-on")}
          >
            <span className="campus-card-name">All campuses</span>
            <span className="sr-only">,</span>{" "}
            <span className="campus-card-meta">Every Eduvos campus</span>
            {choice === ALL_CAMPUSES && <CheckIcon className="campus-card-tick" />}
          </button>
        </li>
        {campuses.map((campus) => (
          <li key={campus.slug}>
            <button
              type="button"
              onClick={() => choose(campus.slug)}
              aria-current={choice === campus.slug ? "true" : undefined}
              className={cx("campus-card", choice === campus.slug && "campus-card-on")}
            >
              <Photo image={{ src: campus.image.src, alt: "" }} sizes="60vw" className="campus-card-photo" />
              <span className="campus-card-name">{campus.name}</span>
              <span className="sr-only">,</span>{" "}
              <span className="campus-card-meta">{campus.liveListings} live listings</span>
              {choice === campus.slug && <CheckIcon className="campus-card-tick" />}
            </button>
          </li>
        ))}
      </Carousel>
    </>
  );
}
