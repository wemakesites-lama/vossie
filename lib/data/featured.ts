import { randomUUID } from "node:crypto";
import { drawFeatured } from "@/lib/featured";
import { FORMER_STAFF } from "@/lib/staff/audit-words";
import { addDays } from "@/lib/staff/rules";
import type { CampusChoice, Seller } from "@/lib/types";
import { listedListings, liveSellerRows, toSeller } from "./catalog";
import type { FeaturedDrawRow, FeaturedPinRow } from "./rows";
import { sampleStore } from "./store";

// Featured today from the store (staff tools spec 2.8, plan decision 9). Who may be featured: Verified, open (approved,
// not paused) and with at least one listed listing. Pins for the campus and day come first, in the order they were
// made, and ignore the week's break; the other places come from the fair daily draw, the campus's own first. A
// campus's row is recorded the first time it's drawn that day (by `${campus}:${day}`, "all" for visitors who haven't
// chosen one), so it stays the same all day. A seller shown there sits out that campus's next six days while others
// can fill the row, then fills what's left, the one shown longest ago first (the soft break, plan amendment 14).
// Adding or removing a pin for a day forgets that campus's row for the day, so the next view draws again. Only
// featuredFor records; the admin's preview doesn't (amendment 22). Every write checks and changes the store with no
// await in between (amendment 19).

/** The homepage's four places (homepage spec 7.10). */
export const FEATURED_PLACES = 4;
/** A seller shown in a campus's row sits out its draws for this many days after (the trust page's week's break). */
export const REST_DAYS = 6;
/** Rows and pins older than this are tidied away as new rows are drawn. */
const KEEP_DAYS = 7;

const drawKey = (campus: string, day: string) => `${campus}:${day}`;

function eligibleSellers(): Seller[] {
  const listed = new Set(listedListings().map((listing) => listing.sellerSlug));
  return liveSellerRows()
    .filter((row) => row.verified && listed.has(row.slug))
    .map(toSeller);
}

/** The sellers an admin may pin (spec 2.8), by name. */
export async function featuredChoices(): Promise<Seller[]> {
  return eligibleSellers().sort((a, b) => a.name.localeCompare(b.name));
}

function pinsFor(campus: string, day: string): FeaturedPinRow[] {
  return [...sampleStore().featuredPins.values()].filter((pin) => pin.campusSlug === campus && pin.day === day);
}

/** The campus's sellers on their break on `day`, each with the last day they were shown there (amendment 14). */
function restingOn(campus: string, day: string): Map<string, string> {
  const resting = new Map<string, string>();
  // Nearest day first, so each seller keeps the last day they were shown.
  for (let back = 1; back <= REST_DAYS; back += 1) {
    const shown = addDays(day, -back);
    for (const slug of sampleStore().featuredDraws.get(drawKey(campus, shown))?.sellerSlugs ?? []) {
      if (!resting.has(slug)) resting.set(slug, shown);
    }
  }
  return resting;
}

/** The row a new draw would give: pins first, then the draw, with the campus's break. Records nothing. */
function draw(campus: CampusChoice, day: string, eligible: readonly Seller[]): FeaturedDrawRow {
  const pinned = pinsFor(campus, day).map((pin) => pin.sellerSlug);
  const drawn = drawFeatured(eligible, campus, day, FEATURED_PLACES, { pinned, resting: restingOn(campus, day) });
  return { key: drawKey(campus, day), campusSlug: campus, day, sellerSlugs: drawn.map((seller) => seller.slug) };
}

/** The row's sellers who can still be featured, in its order: one who has stopped leaves an empty place. */
function sellersIn(row: FeaturedDrawRow, eligible: readonly Seller[]): Seller[] {
  const bySlug = new Map(eligible.map((seller) => [seller.slug, seller]));
  return row.sellerSlugs.flatMap((slug) => bySlug.get(slug) ?? []);
}

function tidy(day: string): void {
  const { featuredDraws, featuredPins } = sampleStore();
  const oldest = addDays(day, -KEEP_DAYS);
  for (const [key, row] of featuredDraws) {
    if (row.day < oldest) featuredDraws.delete(key);
  }
  for (const [id, pin] of featuredPins) {
    if (pin.day < oldest) featuredPins.delete(id);
  }
}

/**
 * A campus's Featured row for a SAST day (spec 2.8): the recorded row when there is one, else a new draw, recorded. A
 * seller who has stopped being eligible since drops out, and the place stays empty until tomorrow (plan decision 9).
 * The homepage's only reader, through getFeatured: it writes, so it's never cached.
 */
export async function featuredFor(campus: CampusChoice, day: string): Promise<Seller[]> {
  const store = sampleStore();
  const eligible = eligibleSellers();
  let row = store.featuredDraws.get(drawKey(campus, day));
  if (!row) {
    row = draw(campus, day, eligible);
    store.featuredDraws.set(row.key, row);
    tidy(day);
  }
  return sellersIn(row, eligible);
}

/**
 * What a campus's row for a day is or would be, for the admin's Featured page (plan amendment 22): the recorded row
 * when there is one, else what the draw would give now. It records nothing, so opening the page changes no one's row.
 */
export async function previewFeatured(campus: CampusChoice, day: string): Promise<Seller[]> {
  const eligible = eligibleSellers();
  return sellersIn(sampleStore().featuredDraws.get(drawKey(campus, day)) ?? draw(campus, day, eligible), eligible);
}

/** A pin (spec 2.8), or why not: a seller who can't be featured, already pinned there that day, or 4 pins already. */
export async function addPin({
  sellerSlug,
  campusSlug,
  day,
  staffId,
  now,
}: {
  sellerSlug: string;
  campusSlug: string;
  day: string;
  staffId: string;
  now: Date;
}): Promise<FeaturedPinRow | "not-eligible" | "taken" | "full"> {
  if (!eligibleSellers().some((seller) => seller.slug === sellerSlug)) return "not-eligible";
  const pins = pinsFor(campusSlug, day);
  if (pins.some((pin) => pin.sellerSlug === sellerSlug)) return "taken";
  if (pins.length >= FEATURED_PLACES) return "full";
  const pin: FeaturedPinRow = {
    id: `pin-${randomUUID()}`,
    sellerSlug,
    campusSlug,
    day,
    pinnedBy: staffId,
    createdAt: now.toISOString(),
  };
  const store = sampleStore();
  store.featuredPins.set(pin.id, pin);
  store.featuredDraws.delete(drawKey(campusSlug, day));
  return { ...pin };
}

/** Removes a pin, and that campus's row for its day, so it's drawn again. The pin, or null when there's none. */
export async function removePin(id: string): Promise<FeaturedPinRow | null> {
  const store = sampleStore();
  const pin = store.featuredPins.get(id);
  if (!pin) return null;
  store.featuredPins.delete(id);
  store.featuredDraws.delete(drawKey(pin.campusSlug, pin.day));
  return { ...pin };
}

/** A pin as the admin's Featured page lists it. */
export type PinView = FeaturedPinRow & { sellerName: string; pinnedByName: string };

/**
 * Pins from `fromDay` on, soonest first, then by campus, then in the order made. An admin whose account has gone is a
 * former staff member, as in the audit log (plan amendment 17).
 */
export async function listPins(fromDay: string): Promise<PinView[]> {
  const store = sampleStore();
  return [...store.featuredPins.values()]
    .filter((pin) => pin.day >= fromDay)
    .sort((a, b) => a.day.localeCompare(b.day) || a.campusSlug.localeCompare(b.campusSlug))
    .map((pin) => ({
      ...pin,
      sellerName: store.sellers.get(pin.sellerSlug)?.name ?? pin.sellerSlug,
      pinnedByName: (pin.pinnedBy ? store.accounts.get(pin.pinnedBy)?.firstName : undefined) ?? FORMER_STAFF,
    }));
}
