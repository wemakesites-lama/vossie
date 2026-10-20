import { randomUUID } from "node:crypto";
import { campuses } from "@/data/fixtures/campuses";
import { categories } from "@/data/fixtures/categories";
import { DEALS_LABEL, PAY_LABELS, PRICE_LABELS } from "@/lib/browse/filters";
import { listingMatches } from "@/lib/browse/results";
import { ALL_CAMPUSES } from "@/lib/campus";
import {
  SAVED_SEARCH_LIMIT,
  savedSearchHref,
  savedSearchLabel,
  searchKey,
  type SearchNames,
} from "@/lib/saved-searches/rules";
import type { MatchQuery, SavedSearchItem, SaveSearchState } from "@/lib/types";
import { shopStatus, toListing } from "./catalog";
import { deleteNotificationsAbout, notifySearchMatch } from "./notifications";
import type { SavedSearchRow } from "./rows";
import { sampleStore } from "./store";

// Saved searches in the sample store (search alerts spec 2.1, 2.4, 2.7 to 2.11 and 2.15; plan decisions 2, 3, 11,
// 13 and 15). Only their owner ever sees them. Server Actions call the writes and pass `now`; only they make ids.
// Labels look up category and campus names each time they're shown.

const NAMES: SearchNames = {
  categories: new Map(categories.map((category) => [category.slug, category.name])),
  campuses: new Map(campuses.map((campus) => [campus.slug, campus.name])),
};

export type AddResult = "saved" | "already" | "limit";

/** The account's saved searches, newest first. */
function searchesOf(accountId: string): SavedSearchRow[] {
  return [...sampleStore().savedSearches.values()]
    .filter((row) => row.accountId === accountId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** What a saved search matches, as browse's query does (plan decision 2). */
function queryOf({ q, category, campus, price, pay, deals }: SavedSearchRow): MatchQuery {
  return { q, category, campus, price, pay, deals };
}

function toItem(row: SavedSearchRow): SavedSearchItem {
  const search = queryOf(row);
  return {
    id: row.id,
    label: savedSearchLabel(search, NAMES),
    href: savedSearchHref(search),
    savedAt: row.createdAt,
    paused: row.pausedAt !== null,
  };
}

const sameAs = (search: MatchQuery) => {
  const key = searchKey(search);
  return (row: SavedSearchRow) => searchKey(queryOf(row)) === key;
};

/** Save this search (spec 2.4): refused when the account has the same search already, or 20 of them. */
export async function addSavedSearch(accountId: string, search: MatchQuery, now: Date): Promise<AddResult> {
  const mine = searchesOf(accountId);
  if (mine.some(sameAs(search))) return "already";
  if (mine.length >= SAVED_SEARCH_LIMIT) return "limit";
  const id = `ss-${randomUUID()}`;
  const { q, category, campus, price, pay, deals } = search;
  sampleStore().savedSearches.set(id, {
    id,
    accountId,
    q,
    category,
    campus,
    price,
    pay,
    deals,
    createdAt: now.toISOString(),
    pausedAt: null,
  });
  return "saved";
}

/** The browse row's state (spec 2.6): this search saved already, the account at 20, or new. */
export async function getSaveSearchState(accountId: string, search: MatchQuery): Promise<SaveSearchState> {
  const mine = searchesOf(accountId);
  if (mine.some(sameAs(search))) return "saved";
  return mine.length >= SAVED_SEARCH_LIMIT ? "limit" : "new";
}

/** Saved's Searches tab (spec 2.7): the account's saved searches, newest first, with their labels and links. */
export async function listSavedSearches(accountId: string): Promise<SavedSearchItem[]> {
  return searchesOf(accountId).map(toItem);
}

/**
 * Pause or Resume alerts (spec 2.8, plan decision 11) on one of the account's saved searches. A second pause keeps
 * the first time. Null when it isn't theirs.
 */
export async function setSavedSearchPaused(
  accountId: string,
  id: string,
  paused: boolean,
  now: Date,
): Promise<SavedSearchItem | null> {
  const row = sampleStore().savedSearches.get(id);
  if (!row || row.accountId !== accountId) return null;
  row.pausedAt = paused ? (row.pausedAt ?? now.toISOString()) : null;
  return toItem(row);
}

/** Delete (spec 2.8): the search and its notifications go. What it was, for the status line; null when not theirs. */
export async function deleteSavedSearch(accountId: string, id: string): Promise<SavedSearchItem | null> {
  const { savedSearches } = sampleStore();
  const row = savedSearches.get(id);
  if (!row || row.accountId !== accountId) return null;
  savedSearches.delete(id);
  await deleteNotificationsAbout("search-match", new Set([id]));
  return toItem(row);
}

/**
 * Tells the students whose saved searches match a listing published for the first time (spec 2.9 to 2.11, plan
 * decision 13), through notifySearchMatch's one-a-day rule. Each active search is tried with browse's own
 * listingMatches, on the listing as buyers see it, oldest search first; an account hears once, under its oldest
 * matching search, and never about its own shop. A listing buyers can't see (hidden, a draft, a paused or waiting
 * shop's) tells no one. How many accounts it told.
 */
export async function notifySavedSearches({ listingId, now }: { listingId: string; now: Date }): Promise<number> {
  const { listings, sellers, savedSearches } = sampleStore();
  const row = listings.get(listingId);
  const shop = row ? sellers.get(row.sellerSlug) : undefined;
  if (!row || !shop || row.hiddenAt || shopStatus(shop) !== "approved") return 0;
  const listing = toListing(row, shop);
  const names = { sellers: new Map([[shop.slug, shop.name]]), categories: NAMES.categories };
  const oldestFirst = [...savedSearches.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const told = new Set<string>();
  for (const saved of oldestFirst) {
    if (saved.pausedAt !== null || told.has(saved.accountId) || saved.accountId === shop.ownerId) continue;
    const search = queryOf(saved);
    if (listingMatches(listing, search, names) === null) continue;
    const notified = await notifySearchMatch({
      accountId: saved.accountId,
      savedSearchId: saved.id,
      label: savedSearchLabel(search, NAMES),
      resultsHref: savedSearchHref(search, "new"),
      listing: { id: listing.id, title: listing.title },
      now,
    });
    if (notified) told.add(saved.accountId);
  }
  return told.size;
}

/** Deleting an account (spec 2.15, plan decision 15): its saved searches and their notifications. */
export async function forgetSavedSearchesOf(accountId: string): Promise<void> {
  const { savedSearches } = sampleStore();
  const ids = new Set<string>();
  for (const [id, row] of savedSearches) {
    if (row.accountId !== accountId) continue;
    savedSearches.delete(id);
    ids.add(id);
  }
  await deleteNotificationsAbout("search-match", ids);
}

/** A saved search in the account's data export (spec 2.15, plan decision 15): by name, with no ids. */
export type SavedSearchExport = {
  label: string;
  /** The words as typed, or null. */
  words: string | null;
  category: string | null;
  /** The campus's name, or "Every campus". */
  campus: string;
  price: string | null;
  pay: string | null;
  deals: string | null;
  alerts: "on" | "paused";
  savedAt: string;
};

export async function exportSavedSearches(accountId: string): Promise<SavedSearchExport[]> {
  return searchesOf(accountId).map((row) => ({
    label: savedSearchLabel(queryOf(row), NAMES),
    words: row.q,
    category: row.category ? (NAMES.categories.get(row.category) ?? row.category) : null,
    campus: row.campus === ALL_CAMPUSES ? "Every campus" : (NAMES.campuses.get(row.campus) ?? row.campus),
    price: row.price ? PRICE_LABELS[row.price] : null,
    pay: row.pay ? PAY_LABELS[row.pay] : null,
    deals: row.deals ? DEALS_LABEL : null,
    alerts: row.pausedAt === null ? "on" : "paused",
    savedAt: row.createdAt,
  }));
}
