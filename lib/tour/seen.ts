/**
 * Whether Home's tour invitation has been answered (guided tour spec 3.5 and 8). A module of its own, holding names
 * and one small function, so the boot script (server code written into <head>) and the nudge's buttons (client code)
 * share the names without client code importing lib/boot-script.ts (see lib/install-event.ts).
 */
export const TOUR_SEEN_KEY = "vossie_tour_seen";
export const TOUR_SEEN_ATTR = "data-toured";

/** Marks <html> so CSS hides the invitation now, and remembers it for the next visit. */
export function markTourSeen(): void {
  document.documentElement.setAttribute(TOUR_SEEN_ATTR, "");
  try {
    localStorage.setItem(TOUR_SEEN_KEY, "1");
  } catch {
    // Storage blocked: the invitation is still hidden for this visit.
  }
}
