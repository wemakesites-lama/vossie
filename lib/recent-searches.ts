export const RECENT_KEY = "vossie_recent_searches";
const MAX_RECENT = 5;

/** Recent searches on this device, newest first. Never throws: storage can be blocked. */
export function getRecentSearches(): string[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
    return Array.isArray(parsed)
      ? parsed.filter((term): term is string => typeof term === "string").slice(0, MAX_RECENT)
      : [];
  } catch {
    return [];
  }
}

export function addRecentSearch(term: string): void {
  const clean = term.trim().replace(/\s+/g, " ");
  if (!clean) return;
  const rest = getRecentSearches().filter((existing) => existing.toLowerCase() !== clean.toLowerCase());
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify([clean, ...rest].slice(0, MAX_RECENT)));
  } catch {
    // Storage blocked: recent searches just won't be remembered.
  }
}

export function clearRecentSearches(): void {
  try {
    localStorage.removeItem(RECENT_KEY);
  } catch {
    // Storage blocked: nothing was stored.
  }
}
