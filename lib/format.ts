import type { Condition, HubPostKind, Listing, LookingForRequest, TrustBadge } from "./types";

/** Rand with commas between thousands, as the approved mockup shows ("R1,200"). */
export function formatRand(amount: number): string {
  return `R${Math.round(amount)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;
}

/** "R250", "From R400", "Free", "Swap" or "R450 or swap" (homepage spec 7.8; browse and listing spec 5.3). */
export function priceLabel(listing: Pick<Listing, "priceZar" | "priceIsFrom" | "payMode">): string {
  if (listing.priceZar === null || listing.payMode === "swap") return "Swap";
  if (listing.priceZar === 0) return "Free";
  const amount = formatRand(listing.priceZar);
  const price = listing.priceIsFrom ? `From ${amount}` : amount;
  return listing.payMode === "both" ? `${price} or swap` : price;
}

const CONDITION_LABELS: Record<Condition, string> = {
  new: "New",
  "like-new": "Like new",
  good: "Good",
  fair: "Fair",
};

export function conditionLabel(condition: Condition): string {
  return CONDITION_LABELS[condition];
}

/** A description for link previews (spec 5.8): line breaks flattened, cut at a word to `max` characters. */
export function shortDescription(text: string, max = 150): string {
  const flat = text.replace(/\s+/g, " ").trim();
  if (flat.length <= max) return flat;
  const cut = flat.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(" ");
  const words = lastSpace > 0 ? cut.slice(0, lastSpace) : cut;
  return `${words.replace(/[,.;:]$/, "")}…`;
}

/** The share card's alt text (spec 5.8). */
export function shareCardAlt(title: string, price: string, campusName: string): string {
  return `${title}, ${price}, at ${campusName} on Vossie`;
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

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** "2026-03" → "March 2026", for "Selling since" (shopping spec 4.1). No timezone maths: it's a month, not a moment. */
export function monthYear(yearMonth: string): string {
  const [year, month] = yearMonth.split("-").map(Number);
  return `${MONTH_NAMES[month - 1]} ${year}`;
}

/** "1 listing", "12 listings". */
export function listingsLabel(count: number): string {
  return count === 1 ? "1 listing" : `${count} listings`;
}

/** A seller's share card's alt text (shopping spec 4.3). */
export function sellerCardAlt(name: string, category: string, campusName: string): string {
  return `${name}, ${category} at ${campusName} on Vossie`;
}

/** "2026-10-24" → "24 Oct". The date is already South African, so there's no timezone maths. */
export function dayMonth(date: string): string {
  const { day, month } = eventDate(date);
  return `${day} ${month}`;
}

/** A request's budget (community spec 4.1): "Budget R300", "Budget R300 or a swap", "Open to offers". */
export function budgetLabel(request: Pick<LookingForRequest, "budgetZar" | "swapWelcome">): string {
  const budget = request.budgetZar === null ? "Open to offers" : `Budget ${formatRand(request.budgetZar)}`;
  return request.swapWelcome ? `${budget} or a swap` : budget;
}

/** A request page's offers line (community spec 4.2): "2 offers so far", or an invitation when there are none. */
export function offersSoFarLabel(offers: number): string {
  return offers === 0 ? "No offers yet. Be the first." : `${offersLabel(offers)} so far`;
}

const HUB_KIND_LABELS: Record<HubPostKind, string> = {
  event: "Event",
  "office-hours": "Office hours",
  tip: "Tip",
};

/** A Hub post's eyebrow (community spec 5.1). */
export function hubKindLabel(kind: HubPostKind): string {
  return HUB_KIND_LABELS[kind];
}

/** An event's numbers (community spec 5.1): "12 going · 80 places". */
export function placesLabel(going: number, capacity: number): string {
  return `${going} going · ${capacity === 1 ? "1 place" : `${capacity} places`}`;
}
