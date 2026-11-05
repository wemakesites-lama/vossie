import { ALL_CAMPUSES, ONLINE_CAMPUS } from "@/lib/campus";
import { inboxPath, threadPath } from "@/lib/messaging/paths";
import { offerPath } from "@/lib/looking-for/paths";
import { editListingPath, NEW_LISTING_PATH, PROFILE_PATH } from "@/lib/selling/paths";
import { sastDate } from "@/lib/time";
import {
  COACH_KINDS,
  DESCRIPTION_WANTED,
  LAUNCHPAD_DAYS,
  LISTINGS_WANTED,
  PER_KIND,
  PHOTOS_WANTED,
  PRICE_RATIO,
  QUIET_DAYS,
  REPLY_WAIT_HOURS,
  SIMILAR_WANTED,
  type CoachKind,
} from "./kinds";
import type { Candidate, FactListing, ShopFacts } from "./types";

// A shop's candidates (AI round two spec 2.1; I1 planning decisions 1 to 9): the catalogue's rules over facts the data
// layer read (lib/data/coach-facts.ts). Pure. The order is the catalogue's, and within a kind the most in need first,
// at most PER_KIND of each.

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;

const days = (from: string, to: number) => Math.floor((to - Date.parse(from)) / DAY_MS);

/** Whole SAST days from `today` (a SAST date) to the day `iso` falls on in South Africa. */
function sastDaysUntil(iso: string, today: string): number {
  return Math.round((Date.parse(sastDate(new Date(iso))) - Date.parse(today)) / DAY_MS);
}

/** The middle of a list of prices, rounded to the rand. */
export function middlePrice(prices: readonly number[]): number {
  const sorted = [...prices].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return Math.round(sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2);
}

const forListing = (kind: CoachKind, l: FactListing, evidence: Candidate["evidence"]): Candidate => ({
  id: `${kind}:${l.id}`,
  kind,
  target: { type: "listing", id: l.id },
  name: l.title,
  evidence,
  href: editListingPath(l.id),
});

const forShop = (kind: CoachKind, evidence: Candidate["evidence"], href: string): Candidate => ({
  id: `${kind}:shop`,
  kind,
  target: { type: "shop", id: null },
  name: null,
  evidence,
  href,
});

export function candidatesFor(facts: ShopFacts, now: Date): Candidate[] {
  const at = now.getTime();
  const today = sastDate(now);
  const byKind: Record<CoachKind, Candidate[]> = Object.fromEntries(COACH_KINDS.map((k) => [k, []])) as never;
  const { queue, listings, shop } = facts;

  const oldest = queue.replies.oldest;
  if (oldest && at - Date.parse(oldest.at) > REPLY_WAIT_HOURS * HOUR_MS) {
    byKind["reply-waiting"].push(
      forShop("reply-waiting", { waiting: queue.replies.count, oldestDays: Math.max(1, days(oldest.at, at)) }, inboxPath("selling")),
    );
  }
  if (queue.sales.length > 0) {
    byKind["mark-sold"].push(
      forShop("mark-sold", { sales: new Set(queue.sales.map((s) => s.listingId)).size }, threadPath(queue.sales[0].conversationId)),
    );
  }
  for (const l of [...listings].sort((a, b) => a.photos - b.photos)) {
    if (l.photos < PHOTOS_WANTED) byKind["add-photos"].push(forListing("add-photos", l, { photos: l.photos }));
  }
  for (const l of [...listings].sort((a, b) => a.descriptionChars - b.descriptionChars)) {
    if (l.descriptionChars < DESCRIPTION_WANTED) byKind["say-more"].push(forListing("say-more", l, { chars: l.descriptionChars }));
  }
  // Quiet since the later of its last change and its newest enquiry, compared as times (not ISO strings); the quietest first.
  const quiet = listings
    .map((l) => {
      const since = Math.max(Date.parse(l.updatedAt), l.lastEnquiryAt ? Date.parse(l.lastEnquiryAt) : 0);
      return { l, quietDays: Math.floor((at - since) / DAY_MS) };
    })
    .filter(({ l, quietDays }) => days(l.updatedAt, at) >= QUIET_DAYS && quietDays >= QUIET_DAYS)
    .sort((a, b) => b.quietDays - a.quietDays);
  for (const { l, quietDays } of quiet) {
    byKind["refresh-quiet"].push(forListing("refresh-quiet", l, { days: quietDays }));
  }
  const priced = listings
    .filter((l) => l.priceZar !== null && l.priceZar > 0 && !l.priceIsFrom && l.similarPrices.length >= SIMILAR_WANTED)
    .map((l) => ({ l, price: l.priceZar!, middle: middlePrice(l.similarPrices) }))
    .filter(({ price, middle }) => middle > 0 && price >= PRICE_RATIO * middle)
    .sort((a, b) => b.price / b.middle - a.price / a.middle);
  for (const { l, price, middle } of priced) {
    byKind["check-price"].push(forListing("check-price", l, { price, middle, similar: l.similarPrices.length }));
  }
  for (const r of facts.requests) {
    byKind["answer-request"].push({
      id: `answer-request:${r.id}`,
      kind: "answer-request",
      target: { type: "request", id: r.id },
      name: r.title,
      evidence: {},
      href: offerPath(r.id),
    });
  }
  if (queue.listings.available < LISTINGS_WANTED) {
    const available = queue.listings.available;
    byKind["list-more"].push(forShop("list-more", { available, more: LISTINGS_WANTED - available }, NEW_LISTING_PATH));
  }
  if (!shop.about.trim() || !shop.hasPhoto) {
    byKind["finish-shop"].push(forShop("finish-shop", { about: shop.about.trim() ? 1 : 0, photo: shop.hasPhoto ? 1 : 0 }, PROFILE_PATH));
  }
  const booked = new Set(facts.booked);
  const near = facts.posts
    .filter((p) => p.kind !== "tip" && p.startsAt !== null && !booked.has(p.id))
    .filter((p) => [shop.campusSlug, ONLINE_CAMPUS, ALL_CAMPUSES].includes(p.campusSlug))
    .filter((p) => sastDaysUntil(p.startsAt!, today) >= 0 && sastDaysUntil(p.startsAt!, today) <= LAUNCHPAD_DAYS)
    .sort((a, b) => a.startsAt!.localeCompare(b.startsAt!));
  for (const p of near) {
    const until = sastDaysUntil(p.startsAt!, today);
    byKind["go-to-launchpad"].push({
      id: `go-to-launchpad:${p.id}`,
      kind: "go-to-launchpad",
      target: { type: "post", id: p.id },
      name: p.title,
      evidence: { days: until, date: Number(sastDate(new Date(p.startsAt!)).slice(8, 10)) },
      href: `/hub/${p.id}`,
    });
  }
  const ticked = new Set(facts.tickedTips);
  const tip = facts.posts
    .filter((p) => p.kind === "tip" && !ticked.has(p.id))
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))[0];
  if (tip) {
    byKind["read-tip"].push({ id: `read-tip:${tip.id}`, kind: "read-tip", target: { type: "post", id: tip.id }, name: tip.title, evidence: {}, href: `/hub/${tip.id}` });
  }
  return COACH_KINDS.flatMap((kind) => byKind[kind].slice(0, kind === "read-tip" ? 1 : PER_KIND));
}
