import type { MouseEvent } from "react";

/** A plain primary click. Modified clicks (new tab, new window, download) and other buttons return false. */
export function isPlainClick(event: MouseEvent): boolean {
  return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
}
