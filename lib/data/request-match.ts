import { onSupabase } from "@/lib/backend";
import { matchRequests, wantedFrom, type MatchCandidate, type StoredMatch, type Wanted } from "@/lib/looking-for/match";
import { closingDay, requestOpenOn, type RequestFields } from "@/lib/looking-for/rules";
import { sastDate } from "@/lib/time";
import type { Listing, MatchQuery } from "@/lib/types";
import { shopStatus, toListing } from "./catalog";
import { findOffer } from "./offers";
import { NAMES } from "./saved-searches";
import { sampleStore } from "./store";

// "Someone's looking for this" (AI round two spec 5; AI stage G plan Task 4): the stored searches of open requests and
// the matching of a first publish against them. Request-time only, never inside "use cache", and no model call here:
// lib/data/request-reading.ts does the reading. Shop coach's answer-request (stage I) uses requestMatchCandidates and
// matchRequests, so the two always agree. Askers are compared, never returned to a page.

const supabase = () => import("./supabase/request-match");

/** Open on `today` (a SAST date), not hidden, an asker's, at this campus, with a stored search. Oldest first. */
export async function requestMatchCandidates(campusSlug: string, today: string): Promise<MatchCandidate[]> {
  if (onSupabase()) return (await supabase()).requestMatchCandidates(campusSlug, today);
  return [...sampleStore().requests.values()]
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))
    .flatMap((row) =>
      row.askerId !== null &&
      row.hiddenAt === null &&
      row.matchQuery !== null &&
      row.campusSlug === campusSlug &&
      requestOpenOn({ status: row.status, closesOn: closingDay(row) }, today)
        ? [{ id: row.id, title: row.title, askerId: row.askerId, query: row.matchQuery, createdAt: row.createdAt }]
        : [],
    );
}

/** The listing as buyers see it now, with its shop's name; null for one they can't (hidden, a draft, a closed shop's). */
async function listedForMatch(listingId: string): Promise<{ listing: Listing; shopName: string } | null> {
  if (onSupabase()) {
    const listed = await (await import("./supabase/saved-searches")).listedListing(listingId);
    return listed ? { listing: listed.listing, shopName: listed.shopName } : null;
  }
  const { listings, sellers } = sampleStore();
  const row = listings.get(listingId);
  const shop = row ? sellers.get(row.sellerSlug) : undefined;
  if (!row || !shop || row.hiddenAt || shopStatus(shop) !== "approved") return null;
  const listing = toListing(row, shop);
  return listing.availability === "available" ? { listing, shopName: shop.name } : null;
}

/**
 * The students a first publish answers (spec 5): the open requests at the listing's campus whose stored search it
 * matches, less the seller's own and ones this shop has offered on (planning decision 7). Null for a listing buyers
 * can't see. No notification: the asker hears only when an offer is made.
 * On Supabase it must run as the shop's owner: it reads the viewer's offers through findOffer (forViewer), so a cron
 * or the backfill never calls it.
 */
export async function requestsWantingListing({
  listingId,
  sellerSlug,
  ownerId,
  now,
}: {
  listingId: string;
  sellerSlug: string;
  ownerId: string;
  now: Date;
}): Promise<Wanted | null> {
  const listed = await listedForMatch(listingId);
  if (!listed) return null;
  const candidates = await requestMatchCandidates(listed.listing.campusSlug, sastDate(now));
  const names = { sellers: new Map([[listed.listing.sellerSlug, listed.shopName]]), categories: NAMES.categories };
  const matches = matchRequests(listed.listing, candidates, names, ownerId);
  const offered = await Promise.all(matches.map((match) => findOffer(match.id, sellerSlug)));
  return wantedFrom(matches.filter((_, index) => offered[index] === null));
}

/**
 * Stores a request's search (`read` true; `query` may be null: read, nothing to match), or clears both (`read` false,
 * `query` null). False for a sample request or one that's gone. On Supabase, save_request_match with the admin client.
 */
export async function saveRequestMatch(id: string, query: MatchQuery | null, read: boolean, now: Date): Promise<boolean> {
  if (!read && query !== null) throw new Error("saveRequestMatch: a search needs a read");
  if (onSupabase()) return (await supabase()).saveRequestMatch(id, query, read, now);
  const row = sampleStore().requests.get(id);
  if (!row || row.askerId === null) return false;
  row.matchQuery = read ? query : null;
  row.matchReadAt = read ? now.toISOString() : null;
  return true;
}

/** The asker's request's stored search and read, or null when it isn't theirs. Never shown: an edit reads it. */
export async function requestMatchOf(askerId: string, id: string): Promise<StoredMatch | null> {
  if (onSupabase()) return (await supabase()).requestMatchOf(askerId, id);
  const row = sampleStore().requests.get(id);
  return row && row.askerId === askerId ? { query: row.matchQuery, readAt: row.matchReadAt } : null;
}

/** Open, shown asker requests never read, oldest first, at most `limit`: the backfill's (planning decision 10). */
export async function unreadRequests(today: string, limit: number): Promise<{ id: string; fields: RequestFields }[]> {
  if (onSupabase()) return (await supabase()).unreadRequests(today, limit);
  return [...sampleStore().requests.values()]
    .filter(
      (row) =>
        row.askerId !== null &&
        row.hiddenAt === null &&
        row.matchReadAt === null &&
        requestOpenOn({ status: row.status, closesOn: closingDay(row) }, today),
    )
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))
    .slice(0, limit)
    .map(({ id, title, categorySlug, campusSlug, details, budgetZar, swapWelcome, neededBy }) => ({
      id,
      fields: { title, categorySlug, campusSlug, details, budgetZar, swapWelcome, neededBy },
    }));
}
