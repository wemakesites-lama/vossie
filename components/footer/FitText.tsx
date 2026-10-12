"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { fitFontSize } from "@/lib/fit-text";

const BASE_SIZE = 100;

/** Sizes its text to fill its parent's content width exactly; refits on resize and once fonts load. */
export function FitText({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const text = ref.current;
    const parent = text?.parentElement;
    if (!text || !parent) return;
    let active = true;

    const fit = () => {
      const style = getComputedStyle(parent);
      const target = parent.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
      text.style.fontSize = `${BASE_SIZE}px`;
      text.style.fontSize = `${fitFontSize(text.getBoundingClientRect().width, BASE_SIZE, target)}px`;
    };

    fit();
    // Refit on the next frame. The text's size sets the observed parent's height, so resizing it inside the
    // callback would trip the browser's "ResizeObserver loop completed with undelivered notifications" warning.
    let frame = 0;
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(fit);
    });
    observer.observe(parent);
    void document.fonts?.ready.then(() => {
      if (active) fit();
    });
    return () => {
      active = false;
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, []);

  return (
    <span ref={ref} className={className}>
      {children}
    </span>
  );
}
