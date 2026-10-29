"use client";

import Link from "next/link";
import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type FocusEvent,
  type PointerEvent,
  type ReactNode,
} from "react";
import { PauseIcon, PlayIcon } from "@/components/icons";
import { useLowData } from "@/hooks/useLowData";
import { useMotionAllowed } from "@/hooks/useMotionAllowed";
import { usePageHidden } from "@/hooks/usePageHidden";
import { cx } from "@/lib/cx";
import type { HeroSlide } from "@/lib/types";
import { Photo } from "@/components/listings/Photo";

const ROTATE_MS = 7000;
const SWIPE_PX = 40;

// The other slides' photos wait for the page's load event, so they never compete with the first (spec 7.3).
function subscribeLoad(listener: () => void) {
  window.addEventListener("load", listener);
  return () => window.removeEventListener("load", listener);
}
const isPageLoaded = () => document.readyState === "complete";
const notLoadedOnServer = () => false;

type PlayChoice = "auto" | "playing" | "paused";

type HeroRotatorProps = {
  slides: readonly HeroSlide[];
  /** What screen readers hear as the H1: one stable sentence (plan decision 3). */
  sentence: string;
  /** The phone's campus chip, which the server streams in. */
  chip: ReactNode;
};

/**
 * The hero slider (spec 7.3): one fixed headline with a changing word, a photo per slide, thumbnails and Pause/Play.
 * Autoplay follows spec 8. It holds for hover, focus and a hidden tab, stops once someone chooses a slide, and never
 * starts with reduced motion or data saver.
 */
export function HeroRotator({ slides, sentence, chip }: HeroRotatorProps) {
  const [index, setIndex] = useState(0);
  const [playChoice, setPlayChoice] = useState<PlayChoice>("auto");
  // Two holds: a mouse over the hero (touch doesn't count), and keyboard focus inside it.
  const [mouseOver, setMouseOver] = useState(false);
  const [focusInside, setFocusInside] = useState(false);
  const swipeStart = useRef<{ x: number; y: number } | null>(null);
  const pageHidden = usePageHidden();
  const pageLoaded = useSyncExternalStore(subscribeLoad, isPageLoaded, notLoadedOnServer);
  const motionAllowed = useMotionAllowed();
  const lowData = useLowData();

  const count = slides.length;
  const playing = playChoice === "playing" || (playChoice === "auto" && motionAllowed);
  const rotating = count > 1 && playing && !mouseOver && !focusInside && !pageHidden;

  useEffect(() => {
    if (!rotating) return;
    const timer = window.setInterval(() => setIndex((current) => (current + 1) % count), ROTATE_MS);
    return () => window.clearInterval(timer);
  }, [rotating, count]);

  /** Someone chose a slide, so autoplay stops (spec 7.3). */
  function show(next: number) {
    setIndex((next + count) % count);
    setPlayChoice("paused");
  }

  const onPointerEnter = (event: PointerEvent<HTMLElement>) => {
    if (event.pointerType === "mouse") setMouseOver(true);
  };
  const onPointerLeave = (event: PointerEvent<HTMLElement>) => {
    if (event.pointerType === "mouse") setMouseOver(false);
  };
  // Focus on a call to action holds autoplay, so the link under the keyboard never goes inert. The slide controls
  // never go inert, so focus there doesn't hold: Play has to work while it has focus.
  const onFocus = (event: FocusEvent<HTMLElement>) => {
    setFocusInside(!(event.target as Element).closest(".hero-controls"));
  };
  const onBlur = (event: FocusEvent<HTMLElement>) => {
    const root = event.currentTarget;
    // Switching to another window leaves activeElement where it was, so keep the hold, or the link would go inert.
    if (!root.contains(event.relatedTarget as Node | null) && !root.contains(document.activeElement)) {
      setFocusInside(false);
    }
  };

  const onSwipeStart = (event: PointerEvent<HTMLElement>) => {
    swipeStart.current = event.pointerType === "mouse" ? null : { x: event.clientX, y: event.clientY };
  };
  const onSwipeEnd = (event: PointerEvent<HTMLElement>) => {
    const start = swipeStart.current;
    swipeStart.current = null;
    if (!start) return;
    const dx = event.clientX - start.x;
    if (Math.abs(dx) > SWIPE_PX && Math.abs(dx) > Math.abs(event.clientY - start.y)) show(index + (dx < 0 ? 1 : -1));
  };

  // The first photo is in the prerendered page. After the load event the others mount, ready for the cross-fade.
  // With data saver on, only the slide on show loads (plan decision 8).
  const mountPhoto = (n: number) => n === 0 || n === index || (pageLoaded && !lowData);

  return (
    <div
      className="hero"
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
      onFocus={onFocus}
      onBlur={onBlur}
    >
      <div className="hero-panel surface-navy texture-stars">
        <div className="hero-chip">{chip}</div>
        <p className="eyebrow text-on-band">Eduvos student marketplace</p>
        <h1 id="hero-title" className="hero-title">
          <span className="sr-only">{sentence}</span>
          {/* What sighted visitors see: the frame stays put, and only the word on its own line changes (plan decision 3). */}
          <span aria-hidden="true" className="hero-frame">
            <span>Buy &amp; sell</span>
            <span className="hero-words">
              {slides.map((slide, n) => (
                <span key={slide.id} className="hero-word" data-active={n === index ? "" : undefined}>
                  {slide.word}
                </span>
              ))}
            </span>
            <span>on campus</span>
          </span>
        </h1>
        {/* Announced when someone changes the slide, never while it turns by itself. */}
        <div className="hero-copies" aria-live={rotating ? "off" : "polite"}>
          {slides.map((slide, n) => (
            <div key={slide.id} className="hero-copy" data-active={n === index ? "" : undefined} inert={n !== index}>
              <p className="hero-body">{slide.body}</p>
              <div className="hero-ctas">
                <Link href={slide.cta.href} prefetch={n === index ? undefined : false} className="btn btn-sky">
                  {slide.cta.label}
                </Link>
                <Link href="/sell" className="btn btn-ghost">
                  Start selling
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div
        className="hero-media"
        onPointerDown={onSwipeStart}
        onPointerUp={onSwipeEnd}
        onPointerCancel={() => {
          swipeStart.current = null;
        }}
      >
        {slides.map((slide, n) =>
          mountPhoto(n) ? (
            <div key={slide.id} className={cx("hero-photo", n === index && "hero-photo-active")} inert={n !== index}>
              <Photo
                image={slide.image}
                sizes="(min-width: 75rem) and (min-height: 30rem) 744px, (min-width: 48rem) and (min-height: 30rem) 62vw, 100vw"
                priority={n === 0}
                className="hero-photo-img"
              />
            </div>
          ) : null,
        )}
        <div className="hero-controls">
          {slides.map((slide, n) => (
            <button
              key={slide.id}
              type="button"
              onClick={() => show(n)}
              aria-label={`Show slide ${n + 1} of ${count}: ${slide.word}`}
              aria-current={n === index ? "true" : undefined}
              className="hero-thumb"
            >
              <Photo image={{ src: slide.image.src, alt: "" }} sizes="48px" className="hero-thumb-img" />
            </button>
          ))}
          <button
            type="button"
            onClick={() => setPlayChoice(playing ? "paused" : "playing")}
            aria-label={playing ? "Pause slides" : "Play slides"}
            className="hero-toggle"
          >
            {playing ? <PauseIcon className="size-6" /> : <PlayIcon className="size-6" />}
          </button>
        </div>
      </div>
    </div>
  );
}
