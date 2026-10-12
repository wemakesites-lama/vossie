"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "@/components/icons";
import { isMotionAllowedNow } from "@/hooks/useMotionAllowed";
import { cx } from "@/lib/cx";

type CarouselProps = {
  /** Names the region and its buttons: "Categories" gives "Previous categories" and "Next categories". */
  label: string;
  /** The section's heading and links, shown left of the arrows. */
  header?: ReactNode;
  /** The slides, each an <li>. */
  children: ReactNode;
  className?: string;
  /** The arrows (desktop only) and the progress bar. */
  controls?: boolean;
};

/**
 * A swipe row (spec 7.5 and section 10). Scrolling and snapping are native CSS. This component only moves the
 * arrows and the progress bar, and the slides stay Server Components.
 */
export function Carousel({ label, header, children, className, controls = true }: CarouselProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLUListElement>(null);
  const [edges, setEdges] = useState({ atStart: true, atEnd: false });

  useEffect(() => {
    const root = rootRef.current;
    const track = trackRef.current;
    if (!root || !track) return;
    let frame = 0;

    const measure = () => {
      frame = 0;
      const max = track.scrollWidth - track.clientWidth;
      const visible = track.scrollWidth > 0 ? Math.min(1, track.clientWidth / track.scrollWidth) : 1;
      root.style.setProperty("--carousel-visible", visible.toFixed(3));
      root.style.setProperty("--carousel-progress", (max > 0 ? track.scrollLeft / max : 0).toFixed(3));
      const atStart = track.scrollLeft <= 1;
      const atEnd = track.scrollLeft >= max - 1;
      setEdges((current) => (current.atStart === atStart && current.atEnd === atEnd ? current : { atStart, atEnd }));
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };

    const observer = new ResizeObserver(schedule);
    observer.observe(track);
    // New slides (after a campus choice re-renders the section) change the row's width without resizing the track.
    const slides = new MutationObserver(schedule);
    slides.observe(track, { childList: true });
    track.addEventListener("scroll", schedule, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      slides.disconnect();
      track.removeEventListener("scroll", schedule);
    };
  }, []);

  function page(direction: 1 | -1) {
    const track = trackRef.current;
    if (!track) return;
    if ((direction === -1 && edges.atStart) || (direction === 1 && edges.atEnd)) return;
    track.scrollBy({ left: direction * track.clientWidth * 0.85, behavior: isMotionAllowedNow() ? "smooth" : "auto" });
  }

  const name = label.toLowerCase();

  return (
    <div
      ref={rootRef}
      role="region"
      aria-roledescription="carousel"
      aria-label={label}
      className={cx("carousel", className)}
    >
      {(header || controls) && (
        <div className="carousel-head">
          <div className="carousel-header">{header}</div>
          {controls && (
            <div className="carousel-arrows">
              {/* aria-disabled, not disabled: a disabled button would drop keyboard focus at the end of the row. */}
              <button
                type="button"
                onClick={() => page(-1)}
                aria-label={`Previous ${name}`}
                aria-disabled={edges.atStart}
                className="carousel-arrow"
              >
                <ChevronLeftIcon className="size-5" />
              </button>
              <button
                type="button"
                onClick={() => page(1)}
                aria-label={`Next ${name}`}
                aria-disabled={edges.atEnd}
                className="carousel-arrow"
              >
                <ChevronRightIcon className="size-5" />
              </button>
            </div>
          )}
        </div>
      )}
      <ul ref={trackRef} className="carousel-track">
        {children}
      </ul>
      {controls && (
        <div className="carousel-bar" aria-hidden="true">
          <span className="carousel-thumb" />
        </div>
      )}
    </div>
  );
}
