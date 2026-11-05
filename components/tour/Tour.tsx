"use client";

import { useEffect, useEffectEvent, useLayoutEffect, useRef, useState } from "react";
import { CloseIcon } from "@/components/icons";
import { NAV_PENDING_EVENT } from "@/components/ui/NavPending";
import { LOW_DATA_ATTR } from "@/lib/low-data";
import { placeCard, type Box } from "@/lib/tour/place";
import { finderFor, findTourPage, isShown, resolveSteps } from "@/lib/tour/resolve";
import { markTourSeen } from "@/lib/tour/seen";
import type { TourId } from "@/lib/tour/targets";
import { NOTHING_HERE, TOURS, type TourStep } from "@/lib/tour/tours";

/** Room round the lit part, so its edge isn't cut by the dim. */
const PAD = 6;
const WIDE = "(min-width: 48rem) and (min-height: 30rem)";
/** The longest the tour waits for a page still streaming in before it reads what's there. */
const WAIT_FOR_PAGE = 4000;

/**
 * A page still streaming in shows skeletons (`.skeleton`) or the blank page fallback, and the parts behind them aren't
 * in the page yet: a tour read then would quietly skip them (seen on Launchpad, whose feed streams in).
 */
function pageLoading(): boolean {
  const main = document.getElementById("main");
  return main !== null && [...main.querySelectorAll(".skeleton, .page-fallback")].some(isShown);
}

type Run = { id: TourId | null; steps: { step: TourStep; element: HTMLElement }[] };

/** Reads the page once, when the tour opens (spec 6.2). The tour renders only in the browser, after a tap. */
function startRun(): Run {
  const found = findTourPage(document);
  if (!found) return { id: null, steps: [] };
  return { id: found.id, steps: resolveSteps(TOURS[found.id], finderFor(document, found.page)) };
}

function padded(rect: DOMRect): Box {
  return { x: rect.left - PAD, y: rect.top - PAD, width: rect.width + PAD * 2, height: rect.height + PAD * 2 };
}

function still(): boolean {
  return matchMedia("(prefers-reduced-motion: reduce)").matches || document.documentElement.hasAttribute(LOW_DATA_ATTR);
}

/**
 * The guided tour (guided tour spec 7): a native modal <dialog>, so the browser traps focus, Escape closes it and the
 * page behind is inert. One window lights the step's part; its spread shadow dims the rest. The card says
 * "Step N of M", the step's words, and Back, Next or Done, and Close.
 */
export default function Tour({ trigger, onClose }: { trigger: HTMLElement | null; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const windowRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  // Null while the page is still streaming in: the tour waits for its parts before reading them.
  const [run, setRun] = useState<Run | null>(() => (pageLoading() ? null : startRun()));
  const [index, setIndex] = useState(0);
  const ready = run !== null;
  const current = run?.steps[index] ?? null;
  const count = run?.steps.length ?? 0;
  const last = index === count - 1;

  function finish(done: boolean) {
    // Only a finished Home tour answers Home's invitation (spec 3.5); closing early doesn't.
    if (done && run?.id === "home") markTourSeen();
    dialogRef.current?.close();
    onClose();
    // Back to what opened it, or to the page when that's gone (the invitation hides once answered). A trigger in the
    // hidden header (the menu button) is inert until the header comes back, so ask it back and focus a frame later.
    const back = trigger?.isConnected && isShown(trigger) ? trigger : null;
    if (back?.closest(".site-header")) dispatchEvent(new Event(NAV_PENDING_EVENT));
    requestAnimationFrame(() => {
      back?.focus();
      if (!back || document.activeElement !== back) document.getElementById("main")?.focus();
    });
  }

  // Open before the first step is placed (the layout effect below runs after this one): a closed dialog is
  // display: none, so the card would measure 0x0 and the title couldn't take focus.
  useLayoutEffect(() => {
    if (!ready) return;
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, [ready]);

  // A page still streaming in: read it once its skeletons have gone, or after WAIT_FOR_PAGE at the most.
  useEffect(() => {
    if (ready) return;
    const read = () => {
      observer.disconnect();
      clearTimeout(timer);
      setRun(startRun());
    };
    const observer = new MutationObserver(() => {
      if (!pageLoading()) read();
    });
    observer.observe(document.getElementById("main") ?? document.body, { childList: true, subtree: true });
    const timer = setTimeout(read, WAIT_FOR_PAGE);
    return () => {
      observer.disconnect();
      clearTimeout(timer);
    };
  }, [ready]);

  // Browser Back closes the tour (spec 6.4).
  const onLeave = useEffectEvent(() => finish(false));
  useEffect(() => {
    addEventListener("popstate", onLeave);
    return () => removeEventListener("popstate", onLeave);
  }, []);

  // The part left the screen (a phone turned past the tablet step): go on to the next step that can show (spec 6.3).
  const onGone = useEffectEvent(() => {
    if (!run) return;
    const found = findTourPage(document);
    const rest = found
      ? resolveSteps(
          run.steps.slice(index).map(({ step }) => step),
          finderFor(document, found.page),
        )
      : [];
    if (rest.length === 0) finish(false);
    else setRun({ id: run.id, steps: [...run.steps.slice(0, index), ...rest] });
  });

  useLayoutEffect(() => {
    const element = current?.element ?? null;
    if (element) {
      // The header hides on scroll: ask it back, as a tapped link does (calm navigation), when the part is in it.
      // It's sticky, so scrolling can't reach a hidden part; the transitionend below re-places once it slides in.
      if (element.closest(".site-header")) dispatchEvent(new Event(NAV_PENDING_EVENT));
      // A part taller than most of the screen (a long list) shows from its top, heading first; anything else centres.
      else
        element.scrollIntoView({
          block: element.getBoundingClientRect().height > innerHeight * 0.6 ? "start" : "center",
          behavior: still() ? "instant" : "smooth",
        });
    }

    let frame = 0;
    function place() {
      frame = 0;
      const win = windowRef.current;
      const card = cardRef.current;
      if (!win || !card) return;
      if (element && !isShown(element)) {
        onGone();
        return;
      }
      const viewport = { width: innerWidth, height: innerHeight };
      const box = element ? padded(element.getBoundingClientRect()) : null;
      const lit = box ?? { x: viewport.width / 2, y: viewport.height / 2, width: 0, height: 0 };
      win.style.translate = `${lit.x}px ${lit.y}px`;
      win.style.width = `${lit.width}px`;
      win.style.height = `${lit.height}px`;
      const bar = document.querySelector(".tabbar");
      const bottomInset = bar && isShown(bar) ? bar.getBoundingClientRect().height : 0;
      const at = placeCard({
        target: box,
        viewport,
        card: { width: card.offsetWidth, height: card.offsetHeight },
        wide: matchMedia(WIDE).matches,
        bottomInset,
      });
      card.style.translate = `${at.x}px ${at.y}px`;
    }
    const later = () => {
      if (!frame) frame = requestAnimationFrame(place);
    };

    place();
    // Screen readers hear "Step 2 of 5, Saved", then the words (spec 7.1).
    titleRef.current?.focus();
    addEventListener("resize", later);
    addEventListener("scroll", later, { passive: true, capture: true });
    addEventListener("transitionend", later, true);
    const observer = element ? new ResizeObserver(later) : null;
    if (element) observer?.observe(element);
    return () => {
      cancelAnimationFrame(frame);
      removeEventListener("resize", later);
      removeEventListener("scroll", later, { capture: true });
      removeEventListener("transitionend", later, true);
      observer?.disconnect();
    };
  }, [current]);

  if (!run) return null;

  return (
    <dialog
      ref={dialogRef}
      className="tour"
      aria-labelledby="tour-title"
      aria-describedby={current ? "tour-body" : undefined}
      onCancel={(event) => {
        event.preventDefault();
        finish(false);
      }}
    >
      <div ref={windowRef} className="tour-window" data-empty={current ? undefined : ""} />
      {/* Keyed by the step, so the card rises in again on each one. */}
      <section ref={cardRef} key={index} className="tour-card">
        <h2 id="tour-title" ref={titleRef} tabIndex={-1} className="tour-title">
          {current ? (
            <>
              <span className="tour-count">{`Step ${index + 1} of ${count}`}</span> {current.step.title}
            </>
          ) : (
            NOTHING_HERE
          )}
        </h2>
        {current && (
          <p id="tour-body" className="tour-body">
            {current.step.body}
          </p>
        )}
        {current && (
          <div className="tour-actions">
            {index > 0 && (
              <button type="button" className="btn btn-outline text-navy" onClick={() => setIndex(index - 1)}>
                Back
              </button>
            )}
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => (last ? finish(true) : setIndex(index + 1))}
            >
              {last ? "Done" : "Next"}
            </button>
          </div>
        )}
        <button type="button" aria-label="Close the tour" className="tour-close" onClick={() => finish(false)}>
          <CloseIcon />
        </button>
      </section>
    </dialog>
  );
}
