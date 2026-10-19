import { randomUUID } from "node:crypto";
import { campuses } from "@/data/fixtures/campuses";
import { categories } from "@/data/fixtures/categories";
import type { RequestFields } from "@/lib/looking-for/rules";
import type { LookingForRequest, OwnRequest, RequestState } from "@/lib/types";
import { deleteNotificationsAbout } from "./notifications";
import type { RequestRow } from "./rows";
import { sampleStore } from "./store";

// Looking For requests in the sample store (community actions spec 2.1, 2.6, 2.11, 2.14 and 2.23; plan decisions 1,
// 4, 6, 10 and 21). Plain functions over the store: lib/data/index.ts wraps the public reads in "use cache", tagged
// "requests"; Server Actions call the writes, then requestsChanged(). The asker is never part of what buyers see.
// Times come from the caller; only Server Actions call createRequest, which makes ids.

/** A request's offers: its offer threads (spec 2.7), whatever state they're in, a shop that has left included. */
function offerThreadCount(requestId: string): number {
  let count = 0;
  for (const row of sampleStore().conversations.values()) {
    if (row.requestId === requestId) count += 1;
  }
  return count;
}

/** A row as part B's LookingForRequest. The offers count is the offer threads plus the sample's number (spec 2.11). */
function toRequest(row: RequestRow): LookingForRequest {
  return {
    id: row.id,
    title: row.title,
    campusSlug: row.campusSlug,
    offers: row.seedOffers + offerThreadCount(row.id),
    details: row.details,
    categorySlug: row.categorySlug,
    budgetZar: row.budgetZar,
    swapWelcome: row.swapWelcome,
    neededBy: row.neededBy,
    createdAt: row.createdAt,
    status: row.status,
  };
}

const notHidden = (row: RequestRow) => row.hiddenAt === null;

function stateOf(row: RequestRow): RequestState {
  return row.hiddenAt !== null ? "hidden" : row.status;
}

function toOwn(row: RequestRow): OwnRequest {
  return { request: toRequest(row), state: stateOf(row), hiddenReason: row.hiddenReason };
}

/** The board's and the homepage's: open and not hidden, in the store's order (plan decision 1). */
export function listedRequests(): LookingForRequest[] {
  return [...sampleStore().requests.values()].filter((row) => row.status === "open" && notHidden(row)).map(toRequest);
}

/** A request's page: anything not hidden, open or closed (spec 2.14). */
export function publicRequest(id: string): LookingForRequest | null {
  const row = sampleStore().requests.get(id);
  return row && notHidden(row) ? toRequest(row) : null;
}

/** Every request with a page, for prerendering and the sitemap. */
export function publicRequestIds(): string[] {
  return [...sampleStore().requests.values()].filter(notHidden).map((row) => row.id);
}

/** The asker's own request, or null when it isn't theirs or doesn't exist (their pages then answer 404). */
export async function getOwnRequest(askerId: string, id: string): Promise<OwnRequest | null> {
  const row = sampleStore().requests.get(id);
  return row && row.askerId === askerId ? toOwn(row) : null;
}

/** Who asked, for an offer's thread (spec 2.7): null for a sample request, which can't take offers, or one that's gone. */
export async function requestAskerId(id: string): Promise<string | null> {
  return sampleStore().requests.get(id)?.askerId ?? null;
}

const ORDER: Readonly<Record<RequestState, number>> = { open: 0, closed: 1, hidden: 2 };

/** Your requests (spec 2.13, plan decision 18): open, then closed, then hidden, each newest first. */
export async function listOwnRequests(askerId: string): Promise<OwnRequest[]> {
  return [...sampleStore().requests.values()]
    .filter((row) => row.askerId === askerId)
    .sort((a, b) => ORDER[stateOf(a)] - ORDER[stateOf(b)] || b.createdAt.localeCompare(a.createdAt))
    .map(toOwn);
}

/** How many of the account's requests are open (not hidden), for the limit of 5 (spec 2.5). */
export async function countOpenRequests(askerId: string): Promise<number> {
  return [...sampleStore().requests.values()].filter((row) => row.askerId === askerId && stateOf(row) === "open")
    .length;
}

/** How many of the account's requests made since `since` are still in the store (plan decision 4). */
export async function countRequestsSince(askerId: string, since: Date): Promise<number> {
  return [...sampleStore().requests.values()].filter(
    (row) => row.askerId === askerId && Date.parse(row.createdAt) > since.getTime(),
  ).length;
}

/** A new, open request (spec 2.3). Server Actions only: it makes ids. */
export async function createRequest({
  askerId,
  fields,
  now,
}: {
  askerId: string;
  fields: RequestFields;
  now: Date;
}): Promise<LookingForRequest> {
  const at = now.toISOString();
  const row: RequestRow = {
    id: `r-${randomUUID()}`,
    askerId,
    ...fields,
    status: "open",
    createdAt: at,
    updatedAt: at,
    closedAt: null,
    seedOffers: 0,
    hiddenAt: null,
    hiddenReason: null,
  };
  sampleStore().requests.set(row.id, row);
  return toRequest(row);
}

/** The asker's row, when it's in `state` (spec 2.6, plan decision 6). */
function ownRow(askerId: string, id: string, state: RequestState): RequestRow | null {
  const row = sampleStore().requests.get(id);
  return row && row.askerId === askerId && stateOf(row) === state ? row : null;
}

/** Edit (spec 2.6): only while it's open. Null when it isn't the asker's open request. */
export async function updateRequest(
  askerId: string,
  id: string,
  fields: RequestFields,
  now: Date,
): Promise<LookingForRequest | null> {
  const row = ownRow(askerId, id, "open");
  if (!row) return null;
  Object.assign(row, fields, { updatedAt: now.toISOString() });
  return toRequest(row);
}

/** Close (`open` false) or Reopen (`open` true) (spec 2.6). Null when there was nothing to do. */
export async function setRequestOpen(
  askerId: string,
  id: string,
  open: boolean,
  now: Date,
): Promise<LookingForRequest | null> {
  const row = ownRow(askerId, id, open ? "closed" : "open");
  if (!row) return null;
  row.status = open ? "open" : "closed";
  row.closedAt = open ? null : now.toISOString();
  row.updatedAt = now.toISOString();
  return toRequest(row);
}

/**
 * Delete (spec 2.6), in any state: the request goes, so its page 404s, and so does the Hub's notification about it.
 * Its offer threads stay, with its title (requestTitle) and "This request was removed." False when it isn't the asker's.
 */
export async function deleteRequest(askerId: string, id: string): Promise<boolean> {
  const { requests } = sampleStore();
  const row = requests.get(id);
  if (!row || row.askerId !== askerId) return false;
  requests.delete(id);
  await deleteNotificationsAbout("request-update", new Set([id]));
  return true;
}

/** What hiding a request tells the action: its title for the log, and the asker to tell (null for a sample). */
export type HiddenRequest = { id: string; title: string; askerId: string | null };

/** The Hub's Hide the request (spec 2.14): it leaves every list and its page 404s. Null when it's gone or hidden already. */
export async function hideRequest(id: string, reason: string, now: Date): Promise<HiddenRequest | null> {
  const row = sampleStore().requests.get(id);
  if (!row || row.hiddenAt !== null) return null;
  row.hiddenAt = now.toISOString();
  row.hiddenReason = reason;
  row.updatedAt = now.toISOString();
  return { id: row.id, title: row.title, askerId: row.askerId };
}

/** Deleting an account (spec 2.23): its requests go. Their offer threads follow messaging's rules. */
export async function forgetRequestsOf(accountId: string): Promise<void> {
  const { requests } = sampleStore();
  for (const [id, row] of requests) {
    if (row.askerId === accountId) requests.delete(id);
  }
}

/** A request in the account's data export (plan decision 21). No ids. */
export type RequestExport = {
  title: string;
  category: string;
  campus: string;
  details: string;
  budgetZar: number | null;
  swapWelcome: boolean;
  neededBy: string | null;
  state: RequestState;
  /** The Hub's reason, when it hid it. */
  hubReason: string | null;
  postedAt: string;
  closedAt: string | null;
  offers: number;
};

const categoryName = (slug: string) => categories.find((category) => category.slug === slug)?.name ?? slug;
const campusName = (slug: string) => campuses.find((campus) => campus.slug === slug)?.name ?? slug;

/** The account's requests for its data export, newest first. */
export async function exportRequests(accountId: string): Promise<RequestExport[]> {
  return [...sampleStore().requests.values()]
    .filter((row) => row.askerId === accountId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((row) => ({
      title: row.title,
      category: categoryName(row.categorySlug),
      campus: campusName(row.campusSlug),
      details: row.details,
      budgetZar: row.budgetZar,
      swapWelcome: row.swapWelcome,
      neededBy: row.neededBy,
      state: stateOf(row),
      hubReason: row.hiddenReason,
      postedAt: row.createdAt,
      closedAt: row.closedAt,
      offers: row.seedOffers + offerThreadCount(row.id),
    }));
}
