import { onSupabase } from "@/lib/backend";
import type { CoachAction, FactListing, LiveFacts, LiveListing, ShopFacts } from "@/lib/coach/types";
import { hasPassed } from "@/lib/hub";
import { matchRequests } from "@/lib/looking-for/match";
import { requestOpenOn } from "@/lib/looking-for/rules";
import { sastDate } from "@/lib/time";
import type { SellerQueue } from "@/lib/types";
import { getHubPost, getHubPosts, getRequest, getSellerListings, searchListings } from "./index";
import { findOffer } from "./offers";
import { requestMatchCandidates } from "./request-match";
import { NAMES } from "./saved-searches";
import { shopConversations } from "./shop-stats";
import { sampleStore } from "./store";

// The facts Shop coach plans a week from and works its done states out from (AI round two spec 2.1 and 4; I1 plan
// Task 6). Through existing readers wherever one exists: the queue comes from the caller (queueFor for the signed-in
// seller), conversations from the counting (shopConversations), similar prices from Browse's searchListings, requests
// from stage G's matcher, posts from the Launchpad's cached readers. Only what the owner's own rows hold (photo counts,
// descriptions, the shop's about and photo, the owner's bookings) is read here, from the store or, on Supabase, with the
// admin client: request-time only, and only the numbers leave the server. Never a buyer's name or a message's text.

export type CoachShop = { slug: string; ownerId: string };
type Queue = Pick<SellerQueue, "replies" | "sales" | "listings">;

const supabase = () => import("./supabase/coach-facts");

/** What the owner's own rows hold: the shop's about and photo, and its listings (any state) as the rules read them. */
export type OwnRows = {
  shop: { campusSlug: string; categorySlug: string; about: string; hasPhoto: boolean };
  listings: (LiveListing & { id: string; title: string; categorySlug: string; priceIsFrom: boolean })[];
};

async function ownRows(slug: string): Promise<OwnRows | null> {
  if (onSupabase()) return (await supabase()).ownRows(slug);
  const { sellers, listings } = sampleStore();
  const shop = sellers.get(slug);
  if (!shop) return null;
  return {
    shop: {
      campusSlug: shop.campusSlug,
      categorySlug: shop.categorySlug,
      about: shop.about,
      hasPhoto: shop.image !== null && !shop.image.src.startsWith("/placeholders/"),
    },
    listings: [...listings.values()]
      .filter((row) => row.sellerSlug === slug)
      .map((row) => ({
        id: row.id,
        title: row.title,
        categorySlug: row.categorySlug,
        state: row.state,
        hidden: Boolean(row.hiddenAt),
        priceZar: row.priceZar,
        priceIsFrom: row.priceIsFrom,
        photos: row.photos.length,
        descriptionChars: Array.from(row.description).length,
        updatedAt: row.updatedAt,
      })),
  };
}

/** The posts the owner has an RSVP or a slot request for, any state, among `postIds` (planning decision 8). */
export async function bookedPosts(ownerId: string, postIds: readonly string[]): Promise<Set<string>> {
  if (onSupabase()) return (await supabase()).bookedPosts(ownerId, postIds);
  const wanted = new Set(postIds);
  const { hubRsvps, hubBookings } = sampleStore();
  return new Set([
    ...[...hubRsvps.values()].filter((r) => r.accountId === ownerId && wanted.has(r.postId)).map((r) => r.postId),
    ...[...hubBookings.values()].filter((b) => b.accountId === ownerId && wanted.has(b.postId)).map((b) => b.postId),
  ]);
}

/** Similar listings' prices (planning decision 6): Browse's own search on the title and category, every campus. */
async function similarPrices(listing: { id: string; title: string; categorySlug: string }, slug: string): Promise<number[]> {
  const { items } = await searchListings({
    q: listing.title,
    category: listing.categorySlug,
    campus: "all",
    price: null,
    pay: null,
    deals: null,
    sort: "match",
  });
  return items
    .filter((l) => l.id !== listing.id && l.sellerSlug !== slug && l.priceZar !== null && l.priceZar > 0 && !l.priceIsFrom)
    .map((l) => l.priceZar as number);
}

/** What a week is planned from (spec 2.1). `tickedTips`: tips ticked in the last 12 weeks. Throws for an unknown shop. */
export async function shopFacts(
  shop: CoachShop,
  queue: Queue,
  now: Date,
  tickedTips: readonly string[],
): Promise<ShopFacts> {
  const today = sastDate(now);
  const own = await ownRows(shop.slug);
  if (!own) throw new Error("shopFacts: no such shop");
  const listed = own.listings.filter((l) => l.state === "available" && !l.hidden);
  const [conversations, publicListings, candidates, upcoming, tips] = await Promise.all([
    shopConversations(shop.slug),
    getSellerListings(shop.slug),
    requestMatchCandidates(own.shop.campusSlug, today),
    getHubPosts({ kinds: ["event", "office-hours"], from: today }),
    getHubPosts({ kinds: ["tip"], from: today }),
  ]);
  const lastEnquiry = new Map<string, string>();
  for (const row of conversations) {
    if (row.listingId === null || row.requestId) continue;
    if ((lastEnquiry.get(row.listingId) ?? "") < row.createdAt) lastEnquiry.set(row.listingId, row.createdAt);
  }
  const listings: FactListing[] = await Promise.all(
    listed.map(async (l) => ({
      id: l.id,
      title: l.title,
      categorySlug: l.categorySlug,
      priceZar: l.priceZar,
      priceIsFrom: l.priceIsFrom,
      photos: l.photos,
      descriptionChars: l.descriptionChars,
      updatedAt: l.updatedAt,
      lastEnquiryAt: lastEnquiry.get(l.id) ?? null,
      similarPrices: l.priceZar !== null && l.priceZar > 0 && !l.priceIsFrom ? await similarPrices(l, shop.slug) : [],
    })),
  );
  // answer-request (planning decision 7): G's matcher on each listing, then the shop's own category.
  const names = { sellers: new Map(publicListings.map((l) => [l.sellerSlug, l.sellerName])), categories: NAMES.categories };
  const paired = new Map<string, { id: string; title: string; via: "listing" | "category"; score: number }>();
  for (const listing of publicListings) {
    for (const match of matchRequests(listing, candidates, names, shop.ownerId)) {
      const kept = paired.get(match.id);
      if (!kept || kept.score < match.score) {
        paired.set(match.id, { id: match.id, title: match.title, via: "listing", score: match.score });
      }
    }
  }
  for (const candidate of candidates) {
    if (!paired.has(candidate.id) && candidate.askerId !== shop.ownerId && candidate.query.category === own.shop.categorySlug) {
      paired.set(candidate.id, { id: candidate.id, title: candidate.title, via: "category", score: -1 });
    }
  }
  const offered = await Promise.all([...paired.keys()].map(async (id) => [id, await findOffer(id, shop.slug)] as const));
  const requests = [...paired.values()]
    .filter((r) => offered.find(([id]) => id === r.id)?.[1] === null)
    .sort((a, b) => (a.via === b.via ? b.score - a.score : a.via === "listing" ? -1 : 1))
    .map(({ id, title, via }) => ({ id, title, via }));
  const posts = [...upcoming, ...tips].map((p) => ({
    id: p.id,
    kind: p.kind as "event" | "office-hours" | "tip",
    title: p.title,
    campusSlug: p.campusSlug,
    startsAt: p.startsAt,
    publishedAt: p.publishedAt,
  }));
  const booked = await bookedPosts(shop.ownerId, upcoming.map((p) => p.id));
  return {
    asOf: now.toISOString(),
    shop: { slug: shop.slug, ...own.shop },
    queue,
    listings,
    requests,
    posts,
    booked: [...booked],
    tickedTips,
  };
}

/** What done states are worked out from, for these actions (spec 4: live, so always current). */
export async function liveFacts(shop: CoachShop, actions: readonly CoachAction[], queue: Queue, now: Date): Promise<LiveFacts> {
  const today = sastDate(now);
  const ids = (type: string) => [...new Set(actions.filter((a) => a.target.type === type && a.target.id).map((a) => a.target.id as string))];
  const [own, booked, requests, posts, offers] = await Promise.all([
    ownRows(shop.slug),
    bookedPosts(shop.ownerId, ids("post")),
    Promise.all(ids("request").map(async (id) => [id, await getRequest(id)] as const)),
    Promise.all(ids("post").map(async (id) => [id, await getHubPost(id)] as const)),
    Promise.all(ids("request").map(async (id) => [id, await findOffer(id, shop.slug)] as const)),
  ]);
  return {
    queue,
    shop: { about: own?.shop.about ?? "", hasPhoto: own?.shop.hasPhoto ?? false },
    listings: new Map(
      (own?.listings ?? []).map(({ id, state, hidden, photos, descriptionChars, priceZar, updatedAt }) => [
        id,
        { state, hidden, photos, descriptionChars, priceZar, updatedAt },
      ]),
    ),
    offered: new Set(offers.filter(([, thread]) => thread !== null).map(([id]) => id)),
    openRequests: new Set(requests.filter(([, r]) => r !== null && requestOpenOn(r, today)).map(([id]) => id)),
    booked,
    publishedPosts: new Set(posts.filter(([, p]) => p !== null).map(([id]) => id)),
    passedPosts: new Set(posts.filter(([, p]) => p !== null && hasPassed(p, today)).map(([id]) => id)),
  };
}
