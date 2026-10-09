export type OverlayName = "menu" | "search" | "campus" | "install-help";

type OpenListener = (trigger: HTMLElement | null) => void;

const listeners: Record<OverlayName, Set<OpenListener>> = {
  menu: new Set(),
  search: new Set(),
  campus: new Set(),
  "install-help": new Set(),
};

/** Ask an overlay to open. `trigger` gets focus back when it closes. */
export function openOverlay(name: OverlayName, trigger: HTMLElement | null = null): void {
  listeners[name].forEach((listener) => listener(trigger));
}

export function onOverlayOpen(name: OverlayName, listener: OpenListener): () => void {
  listeners[name].add(listener);
  return () => {
    listeners[name].delete(listener);
  };
}
