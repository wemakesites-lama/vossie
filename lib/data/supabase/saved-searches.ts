import "server-only";
import { listingMatches } from "@/lib/browse/results";
import { SAVED_SEARCH_LIMIT, savedSearchHref, savedSearchLabel, searchKey } from "@/lib/saved-searches/rules";
import type { PayFilter, PriceFilter } from "@/lib/types";
import { catalogOver } from "../catalog";
import type { SavedSearchRow } from "../rows";
import type * as Sample from "../saved-searches";
import { NAMES, queryOf, searchExport, toItem } from "../saved-searches";
import { catalogSourceFrom, LISTING_COLUMNS, SHOP_COLUMNS } from "./catalog";
import { forPublic, forServer, type DbClient } from "./clients";
import { campusFromDb, campusToDb, iso, selectAll } from "./rows";
import { forViewerAs } from "./viewer";

// Saved searches on Supabase (C4/C5 plan Task 8; decisions 6, 9 and 10). Only their owner ever reads them: the
// saved_searches policy, through their own session. The writes are save_search, set_search_paused and delete_search.
// Matching a first publish stays in TypeScript, with browse's own listingMatches over the listing as buyers see it
// (CLAUDE.md: SQL never copies browse's search rules); only the matched ids and each one's label and link reach
// record_search_matches, which tells each account once a day under its oldest matching search (notify_once_per_day).
// Labels and the download come from the sample module's own mappers. Never cached: request-time only.

const COLUMNS = "id, account_id, q, category, campus_slug, price, pay, deals, created_at, paused_at";

type SearchRecord = {
  id: string;
  account_id: string;
  q: string | null;
  category: string | null;
  campus_slug: string | null;
  price: string | null;
  pay: string | null;
  deals: string | null;
  created_at: string;
  paused_at: string | null;
};

function failed(what: string, error: { code?: string }): never {
  throw new Error(`${what} failed (${error.code ?? "unknown"})`);
}

/** A saved_searches row as the store's row, so the sample's mappers read it. */
function rowFrom(record: SearchRecord): SavedSearchRow {
  return {
    id: record.id,
    accountId: record.account_id,
    q: record.q,
    category: record.category,
    campus: campusFromDb(record.campus_slug),
    price: record.price as PriceFilter | null,
    pay: record.pay as PayFilter | null,
    deals: record.deals as SavedSearchRow["deals"],
    createdAt: iso(record.created_at),
    pausedAt: record.paused_at === null ? null : iso(record.paused_at),
  };
}

/** The account's saved searches, newest first. */
async function searchesOf(client: DbClient): Promise<SavedSearchRow[]> {
  const { data, error } = await client
    .from("saved_searches")
    .select(COLUMNS)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false });
  if (error) failed("saved_searches", error);
  return data.map(rowFrom);
}

async function searchOf(client: DbClient, id: string): Promise<SavedSearchRow | null> {
  const { data, error } = await client.from("saved_searches").select(COLUMNS).eq("id", id).maybeSingle();
  if (error) failed("saved_searches", error);
  return data ? rowFrom(data) : null;
}

/** Save this search: save_search refuses the same key twice and a 21st, under the account's lock. */
export const addSavedSearch: typeof Sample.addSavedSearch = async (accountId, search) => {
  const { data, error } = await (await forViewerAs(accountId)).rpc("save_search", {
    p_q: search.q as string,
    p_category: search.category as string,
    p_campus_slug: campusToDb(search.campus) as string,
    p_price: search.price as string,
    p_pay: search.pay as string,
    p_deals: search.deals as string,
    p_search_key: searchKey(search),
  });
  if (error) failed("save_search", error);
  if (data !== "saved" && data !== "already" && data !== "limit") throw new Error(`save_search answered ${data}`);
  return data;
};

export const getSaveSearchState: typeof Sample.getSaveSearchState = async (accountId, search) => {
  const mine = await searchesOf(await forViewerAs(accountId));
  const key = searchKey(search);
  if (mine.some((row) => searchKey(queryOf(row)) === key)) return "saved";
  return mine.length >= SAVED_SEARCH_LIMIT ? "limit" : "new";
};

export const listSavedSearches: typeof Sample.listSavedSearches = async (accountId) =>
  (await searchesOf(await forViewerAs(accountId))).map(toItem);

/** Pause or Resume alerts: a second pause keeps the first time (set_search_paused). Null when it isn't theirs. */
export const setSavedSearchPaused: typeof Sample.setSavedSearchPaused = async (accountId, id, paused) => {
  const client = await forViewerAs(accountId);
  const { data, error } = await client.rpc("set_search_paused", { p_id: id, p_paused: paused });
  if (error) failed("set_search_paused", error);
  if (data === "not-found") return null;
  if (data !== "paused" && data !== "resumed") throw new Error(`set_search_paused answered ${data}`);
  const row = await searchOf(client, id);
  return row ? toItem(row) : null;
};

/** Delete: the search and its alerts go (delete_search). What it was; null when it isn't theirs. */
export const deleteSavedSearch: typeof Sample.deleteSavedSearch = async (accountId, id) => {
  const client = await forViewerAs(accountId);
  const row = await searchOf(client, id);
  if (!row) return null;
  const { data, error } = await client.rpc("delete_search", { p_id: id });
  if (error) failed("delete_search", error);
  return data === "deleted" ? toItem(row) : null;
};

/** The listing as buyers see it now, read through the cookieless client, never a cache the save has just expired. */
async function listedListing(listingId: string) {
  const listing = await forPublic().from("listings").select(LISTING_COLUMNS).eq("id", listingId).maybeSingle();
  if (listing.error) failed("listings", listing.error);
  if (!listing.data) return null;
  const [shop, storefront] = await Promise.all([
    forPublic().from("shops").select(SHOP_COLUMNS).eq("id", listing.data.shop_id).maybeSingle(),
    forPublic().from("storefronts").select("shop_id, status").eq("shop_id", listing.data.shop_id),
  ]);
  if (shop.error) failed("shops", shop.error);
  if (storefront.error) failed("storefronts", storefront.error);
  if (!shop.data) return null;
  const catalog = catalogOver(
    catalogSourceFrom({
      shops: [shop.data],
      storefronts: storefront.data.flatMap((row) => (row.shop_id ? [{ shop_id: row.shop_id, status: row.status }] : [])),
      shopPoints: [],
      listings: [listing.data],
    }),
  );
  const found = catalog.listedListings().find((item) => item.id === listingId);
  return found ? { listing: found, shopId: shop.data.id, shopName: shop.data.name } : null;
}

/**
 * Tells the students whose saved searches match a listing published for the first time (spec 2.9 to 2.11). Request-
 * time only, through the admin client (decision 9): every active search but the shop owner's is tried with browse's
 * listingMatches, oldest first; record_search_matches then tells each account once, under its oldest match, once a day
 * per search. A listing buyers can't see (hidden, a draft, a paused or waiting shop's) tells no one. How many accounts
 * it told.
 */
export const notifySavedSearches: typeof Sample.notifySavedSearches = async ({ listingId }) => {
  const listed = await listedListing(listingId);
  if (!listed) return 0;
  const server = forServer();
  const owner = await server.from("seller_profiles").select("account_id").eq("shop_id", listed.shopId).maybeSingle();
  if (owner.error) failed("seller_profiles", owner.error);
  const ownerId = owner.data?.account_id ?? null;
  const records = await selectAll(
    () => {
      const active = server.from("saved_searches").select(COLUMNS).is("paused_at", null);
      return ownerId ? active.neq("account_id", ownerId) : active;
    },
    ["created_at", "id"],
  );
  const names = { sellers: new Map([[listed.listing.sellerSlug, listed.shopName]]), categories: NAMES.categories };
  const texts: Record<string, { label: string; href: string }> = {};
  for (const row of records.map(rowFrom)) {
    const search = queryOf(row);
    if (listingMatches(listed.listing, search, names) === null) continue;
    texts[row.id] = { label: savedSearchLabel(search, NAMES), href: savedSearchHref(search, "new") };
  }
  const ids = Object.keys(texts);
  if (ids.length === 0) return 0;
  const { data, error } = await server.rpc("record_search_matches", {
    p_listing_id: listingId,
    p_search_ids: ids,
    p_texts: texts,
  });
  if (error) failed("record_search_matches", error);
  return data;
};

/** Deleting an account's saved searches, and their alerts, is forget_account's (phase B's deleteAccountData). */
export const forgetSavedSearchesOf: typeof Sample.forgetSavedSearchesOf = async () => {
  throw new Error("forgetSavedSearchesOf: forget_account does this on Supabase (phase B's deleteAccountData)");
};

/** The account's saved searches for the download, by name, newest first, with no ids. */
export const exportSavedSearches: typeof Sample.exportSavedSearches = async (accountId) =>
  (await searchesOf(await forViewerAs(accountId))).map(searchExport);
