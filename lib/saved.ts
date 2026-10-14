import { preferenceCookie, readCookie } from "./cookies";

/** The saved list's cookie (shopping spec 5.1): listing ids, newest first, joined with ".". */
export const SAVED_COOKIE = "vossie_saved";
/** The most it keeps; saving another drops the oldest. 100 of Supabase's 36-character ids fit in a cookie's 4 KB. */
export const SAVED_LIMIT = 100;

const SAVED_ID = /^[a-z0-9-]{1,40}$/;

/**
 * The saved ids in the cookie's value, newest first. Bad values and repeats are dropped, and only the first 100 are
 * kept. The server reads the cookie with this too (lib/data/saved.ts), so both agree on what's saved.
 */
export function parseSavedIds(raw: string | null | undefined): string[] {
  const ids: string[] = [];
  for (const id of raw?.split(".") ?? []) {
    if (ids.length < SAVED_LIMIT && SAVED_ID.test(id) && !ids.includes(id)) ids.push(id);
  }
  return ids;
}

/** The cookie that holds `ids`. An empty list deletes it. */
export function savedCookieString(ids: readonly string[], secure: boolean): string {
  return preferenceCookie(SAVED_COOKIE, ids.join("."), secure);
}

// --- Client store over the cookie ----------------------------------------

const listeners = new Set<() => void>();

/** Saved listing ids on this device, newest first. */
export function readSavedIds(): string[] {
  return parseSavedIds(readCookie(document.cookie, SAVED_COOKIE));
}

export function getSavedCount(): number {
  return readSavedIds().length;
}

export function isSaved(id: string): boolean {
  return readSavedIds().includes(id);
}

/**
 * Save or unsave a listing. Returns true when it is now saved.
 * Throws when the cookie didn't take (cookies are blocked), so the caller can show "Couldn't update. Try again."
 */
export function toggleSaved(id: string): boolean {
  const ids = readSavedIds();
  const saving = !ids.includes(id);
  const next = saving ? [id, ...ids].slice(0, SAVED_LIMIT) : ids.filter((saved) => saved !== id);
  document.cookie = savedCookieString(next, window.location.protocol === "https:");
  // A browser with cookies blocked drops the write without a word, so check it took.
  if (readSavedIds().join(".") !== next.join(".")) throw new Error("The saved list couldn't be updated");
  listeners.forEach((listener) => listener());
  return saving;
}

/**
 * Forget saved ids whose listings no longer exist, so the cookie and the header's count stop carrying them. The other
 * ids keep their order. Never throws: a browser with cookies blocked has nothing to forget, and one that refuses the
 * write is left as it was.
 */
export function forgetSaved(ids: readonly string[]): void {
  try {
    const saved = readSavedIds();
    const next = saved.filter((id) => !ids.includes(id));
    if (next.length === saved.length) return;
    document.cookie = savedCookieString(next, window.location.protocol === "https:");
  } catch {
    return;
  }
  listeners.forEach((listener) => listener());
}

export function subscribeSaved(listener: () => void): () => void {
  listeners.add(listener);
  // Another tab may have saved something: re-check when this tab comes back into view.
  document.addEventListener("visibilitychange", listener);
  return () => {
    listeners.delete(listener);
    document.removeEventListener("visibilitychange", listener);
  };
}
