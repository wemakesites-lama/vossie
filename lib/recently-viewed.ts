import type { ImageRef } from "./types";

export const RECENTLY_VIEWED_KEY = "vossie_recently_viewed";
const MAX_ITEMS = 6;

/** What the context strip needs to show a listing again. Kept on this device only (POPIA: it never leaves it). */
export type ViewedItem = { id: string; title: string; image: ImageRef };

const EMPTY: readonly ViewedItem[] = [];
const listeners = new Set<() => void>();
let cachedRaw: string | null = null;
let cachedItems: readonly ViewedItem[] = EMPTY;

function readRaw(): string | null {
  try {
    return localStorage.getItem(RECENTLY_VIEWED_KEY);
  } catch {
    return null;
  }
}

function isViewedItem(value: unknown): value is ViewedItem {
  if (typeof value !== "object" || value === null) return false;
  const item = value as { id?: unknown; title?: unknown; image?: { src?: unknown; alt?: unknown } | null };
  return (
    typeof item.id === "string" &&
    typeof item.title === "string" &&
    typeof item.image === "object" &&
    item.image !== null &&
    typeof item.image.alt === "string" &&
    typeof item.image.src === "string" &&
    // Only our own files: next/image refuses unknown hosts, and storage can be edited by hand.
    item.image.src.startsWith("/") &&
    !item.image.src.startsWith("//")
  );
}

function parse(raw: string | null): readonly ViewedItem[] {
  if (!raw) return EMPTY;
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isViewedItem).slice(0, MAX_ITEMS) : EMPTY;
  } catch {
    return EMPTY;
  }
}

/** Listings viewed on this device, newest first. The same array until storage changes, as useSyncExternalStore needs. */
export function getRecentlyViewed(): readonly ViewedItem[] {
  const raw = readRaw();
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedItems = parse(raw);
  }
  return cachedItems;
}

export function recordRecentlyViewed(item: ViewedItem): void {
  const rest = getRecentlyViewed().filter((existing) => existing.id !== item.id);
  try {
    localStorage.setItem(RECENTLY_VIEWED_KEY, JSON.stringify([item, ...rest].slice(0, MAX_ITEMS)));
  } catch {
    return; // Storage blocked: the strip just won't remember this one.
  }
  listeners.forEach((listener) => listener());
}

export function subscribeRecentlyViewed(listener: () => void): () => void {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    // A null key means another tab cleared all storage.
    if (event.key === RECENTLY_VIEWED_KEY || event.key === null) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}
