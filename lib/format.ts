import type { Listing, TrustBadge } from "./types";

/** Rand with commas between thousands, as the approved mockup shows ("R1,200"). */
export function formatRand(amount: number): string {
  return `R${Math.round(amount)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;
}

/** "R250", "From R400" or "Swap" (spec 7.8). */
export function priceLabel(listing: Pick<Listing, "priceZar" | "priceIsFrom" | "payMode">): string {
  if (listing.priceZar === null || listing.payMode === "swap") return "Swap";
  const amount = formatRand(listing.priceZar);
  return listing.priceIsFrom ? `From ${amount}` : amount;
}

const BADGE_LABELS: Record<TrustBadge, string> = {
  trusted: "Trusted",
  responsive: "Responsive",
  "new-seller": "New seller",
};

export function badgeLabel(badge: TrustBadge): string {
  return BADGE_LABELS[badge];
}

export function offersLabel(offers: number): string {
  if (offers === 0) return "No offers yet";
  return offers === 1 ? "1 offer" : `${offers} offers`;
}

/** ["a", "b", "c"] → "a, b and c". */
export function joinWords(words: readonly string[]): string {
  if (words.length <= 1) return words.join("");
  return `${words.slice(0, -1).join(", ")} and ${words.at(-1)}`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-10-05" → { day: "5", month: "Oct" }, for an event's date block. No timezone maths: the date is already SAST. */
export function eventDate(date: string): { day: string; month: string } {
  const [, month, day] = date.split("-").map(Number);
  return { day: String(day), month: MONTHS[month - 1] };
}
