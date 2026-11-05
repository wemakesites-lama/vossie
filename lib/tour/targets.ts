/**
 * The guided tour's names (guided tour spec 5). Pages and the menu import this, so it holds types, one short array
 * and one check: nothing else. The steps' words are in lib/tour/tours.ts, which only the tour's own chunk imports.
 */
export const TOUR_IDS = ["home", "browse", "listing", "sell", "you"] as const;
export type TourId = (typeof TOUR_IDS)[number];

/** Every part a step can point at, written in markup as data-tour="…". */
export type TourTarget =
  | "search"
  | "hero-campus"
  | "hdr-campus"
  | "tab-shop"
  | "hdr-shop"
  | "tab-sell"
  | "hdr-sell"
  | "tab-myshop"
  | "tab-mentoring"
  | "tab-today"
  | "tab-saved"
  | "hdr-saved"
  | "tab-messages"
  | "tab-you"
  | "hdr-account"
  | "menu"
  | "browse-categories"
  | "browse-filters"
  | "browse-sort"
  | "browse-save-search"
  | "listing-gallery"
  | "listing-seller"
  | "listing-actions"
  | "listing-report"
  | "sell-needs-you"
  | "sell-coach"
  | "sell-add"
  | "sell-listings"
  | "sell-bar"
  | "you-for-you"
  | "you-stuff"
  | "you-settings";

/** One part, or a list where the first one on screen wins (a phone tab, then its header link). */
export type StepTarget = TourTarget | readonly TourTarget[];

export function isTourId(value: string | undefined): value is TourId {
  return (TOUR_IDS as readonly string[]).includes(value ?? "");
}
