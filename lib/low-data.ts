export const LOW_DATA_KEY = "vossie_low_data";
export const LOW_DATA_ATTR = "data-low-data";

const listeners = new Set<() => void>();

/** The <html> attribute is the source of truth; the boot script sets it before first paint. */
export function getLowData(): boolean {
  return document.documentElement.hasAttribute(LOW_DATA_ATTR);
}

export function setLowData(on: boolean): void {
  document.documentElement.toggleAttribute(LOW_DATA_ATTR, on);
  try {
    localStorage.setItem(LOW_DATA_KEY, on ? "1" : "0");
  } catch {
    // Storage blocked: the switch still works for this visit.
  }
  listeners.forEach((listener) => listener());
}

export function subscribeLowData(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
