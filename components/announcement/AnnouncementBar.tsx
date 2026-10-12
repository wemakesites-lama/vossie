"use client";

import Link from "next/link";
import { useEffect, useState, type FocusEvent, type PointerEvent } from "react";
import { PauseIcon, PlayIcon } from "@/components/icons";
import { useMotionAllowed } from "@/hooks/useMotionAllowed";
import type { Announcement } from "@/lib/types";

const ROTATE_MS = 6000;

type PlayChoice = "auto" | "playing" | "paused";

/** Announcement bar (spec section 6.1): up to three messages, cross-fading every six seconds. */
export function AnnouncementBar({ messages }: { messages: readonly Announcement[] }) {
  const items = messages.slice(0, 3);
  const [index, setIndex] = useState(0);
  const [playChoice, setPlayChoice] = useState<PlayChoice>("auto");
  // Two separate holds: a mouse over the bar (touch taps don't count), and keyboard focus on the message.
  const [mouseOver, setMouseOver] = useState(false);
  const [messageFocused, setMessageFocused] = useState(false);
  const [pageHidden, setPageHidden] = useState(false);
  const motionAllowed = useMotionAllowed();
  const playing = playChoice === "playing" || (playChoice === "auto" && motionAllowed);
  const rotating = items.length > 1 && playing && !mouseOver && !messageFocused && !pageHidden;

  useEffect(() => {
    const onVisibility = () => setPageHidden(document.visibilityState === "hidden");
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  useEffect(() => {
    if (!rotating) return;
    const timer = window.setInterval(() => setIndex((current) => (current + 1) % items.length), ROTATE_MS);
    return () => window.clearInterval(timer);
  }, [rotating, items.length]);

  const onPointerEnter = (event: PointerEvent<HTMLElement>) => {
    if (event.pointerType === "mouse") setMouseOver(true);
  };
  const onPointerLeave = (event: PointerEvent<HTMLElement>) => {
    if (event.pointerType === "mouse") setMouseOver(false);
  };
  const onMessageBlur = (event: FocusEvent<HTMLElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setMessageFocused(false);
  };

  if (items.length === 0) return null;

  return (
    <section
      aria-label="Announcements"
      className="announce surface-navy"
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
    >
      <div className="announce-inner">
        <div className="announce-stack" onFocus={() => setMessageFocused(true)} onBlur={onMessageBlur}>
          {items.map((message, position) => (
            <Link
              key={message.id}
              href={message.href}
              className="announce-item"
              data-active={position === index ? "" : undefined}
              inert={position !== index}
            >
              <span className="announce-tag">{message.tag}</span>{" "}
              <span className="announce-text">{message.text}</span>
            </Link>
          ))}
        </div>
        {items.length > 1 && (
          <button
            type="button"
            onClick={() => setPlayChoice(playing ? "paused" : "playing")}
            aria-label={playing ? "Pause announcements" : "Play announcements"}
            className="announce-toggle"
          >
            {playing ? <PauseIcon className="size-4" /> : <PlayIcon className="size-4" />}
          </button>
        )}
      </div>
    </section>
  );
}
