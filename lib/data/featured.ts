import { randomUUID } from "node:crypto";
import { onSupabase } from "@/lib/backend";
import { drawFeatured } from "@/lib/featured";
import { addDays } from "@/lib/staff/rules";
import type { CampusChoice, Seller } from "@/lib/types";
import { type Catalog, listedListings, liveSellerRows, toSeller } from "./catalog";
import type { FeaturedPinRow } from "./rows";
import { isOwnShop } from "./staff-shops";
import { sampleStore } from "./store";

// Featured today from the store (staff tools spec 2.8, plan decision 9). Who may be featured: Verified, open (approved,
// not paused) and with at least one listed listing. Pins for the campus and day come first, in the order they were
// made, and ignore the week's break; the other places come from the fair daily draw, the campus's own first. A
// campus's row is recorded the first time it's drawn that day (by `${campus}:${day}`, "all" for visitors who haven't
// chosen one), so it stays the same all day and a seller shown there sits out that campus's next six days. The break
// is a preference (plan amendment 3): resting sellers come after everyone else rather than being left out, so a row
// is only short when there aren't enough eligible sellers at all. When resting sellers are needed, the campus's own
// come first, then whoever was featured longest ago (stage M). Adding or removing a pin for a day forgets that
// campus's row for the day, so the next view draws again.

/** The homepage's four places (homepage spec 7.10). */
export const FEATURED_PLACES = 4;
/** A seller shown in a campus's row sits out its draws for this many days after (the trust page's week's break). */
export const REST_DAYS = 6;
/** Rows older than this are tidied away as new ones are drawn. */
export const KEEP_DAYS = 7;

const drawKey = (campus: string, day: string) => `${campus}:${day}`;

/** Who may be featured, by the catalog's rules over either backend's rows (2b plan Task 18). */
export function eligibleIn(shown: Pick<Catalog, "listedListings" | "liveSellerRows">): Seller[] {
  const listed = new Set(shown.listedListings().map((listing) => listing.sellerSlug));
  return shown
    .liveSellerRows()
    .filter((row) => row.verified && listed.has(row.slug))
    .map(toSeller);
}

function eligibleSellers(): Seller[] {
  return eligibleIn({ listedListings, liveSellerRows });
}

/**
 * The week's break, with the latest day each resting seller was in a campus's row: walking back from the day before
 * `day`, the first day met is the latest (stage M spec decision 11). A pinned day counts: pins are in the row. `rowOn`
 * gives the campus's recorded row on a day, if any.
 */
export function restingBefore(day: string, rowOn: (shown: string) => readonly string[] | undefined): Map<string, string> {
  const resting = new Map<string, string>();
  for (let back = 1; back <= REST_DAYS; back += 1) {
    const shown = addDays(day, -back);
    for (const slug of rowOn(shown) ?? []) {
      if (!resting.has(slug)) resting.set(slug, shown);
    }
  }
  return resting;
}

/**
 * The sellers an admin may pin (spec 2.8), by name, leaving out `viewerId`'s own shop: another admin must pin it
 * (stage L spec decision 1). Null leaves nobody out.
 */
export async function featuredChoices(viewerId: string | null = null): Promise<Seller[]> {
  return eligibleSellers()
    .filter((seller) => viewerId === null || !isOwnShop(viewerId, seller.slug))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function pinsFor(campus: string, day: string): FeaturedPinRow[] {
  return [...sampleStore().featuredPins.values()].filter((pin) => pin.campusSlug === campus && pin.day === day);
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
 */
export async function featuredFor(campus: CampusChoice, day: string): Promise<Seller[]> {
  if (onSupabase()) return (await import("./supabase/featured")).featuredFor(campus, day);
  const store = sampleStore();
  const eligible = eligibleSellers();
  const key = drawKey(campus, day);
  let row = store.featuredDraws.get(key);
  if (!row) {
    const resting = restingBefore(day, (shown) => store.featuredDraws.get(drawKey(campus, shown))?.sellerSlugs);
    const pinned = pinsFor(campus, day).map((pin) => pin.sellerSlug);
    const drawn = drawFeatured(eligible, campus, day, FEATURED_PLACES, { pinned, resting });
    row = { key, campusSlug: campus, day, sellerSlugs: drawn.map((seller) => seller.slug) };
    store.featuredDraws.set(key, row);
    tidy(day);
  }
  const bySlug = new Map(eligible.map((seller) => [seller.slug, seller]));
  return row.sellerSlugs.flatMap((slug) => bySlug.get(slug) ?? []);
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

/** One pin, so Remove can check whose shop it is before anything changes (stage L spec decision 1). Null when none. */
export async function getPin(id: string): Promise<FeaturedPinRow | null> {
  const pin = sampleStore().featuredPins.get(id);
  return pin ? { ...pin } : null;
}

/** A pin as the admin's Featured page lists it. `own`: the viewing admin's own shop, so another admin removes it. */
export type PinView = FeaturedPinRow & { sellerName: string; pinnedByName: string; own: boolean };

/** Pins from `fromDay` on, soonest first, then by campus, then in the order made. `viewerId` marks their own. */
export async function listPins(fromDay: string, viewerId: string | null = null): Promise<PinView[]> {
  const store = sampleStore();
  return [...store.featuredPins.values()]
    .filter((pin) => pin.day >= fromDay)
    .sort((a, b) => a.day.localeCompare(b.day) || a.campusSlug.localeCompare(b.campusSlug))
    .map((pin) => ({
      ...pin,
      sellerName: store.sellers.get(pin.sellerSlug)?.name ?? pin.sellerSlug,
      pinnedByName: (pin.pinnedBy ? store.accounts.get(pin.pinnedBy)?.firstName : undefined) ?? "Deleted account",
      own: viewerId !== null && isOwnShop(viewerId, pin.sellerSlug),
    }));
}
