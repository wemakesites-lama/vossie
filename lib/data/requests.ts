import { randomUUID } from "node:crypto";
import { campuses } from "@/data/fixtures/campuses";
import { categories } from "@/data/fixtures/categories";
import { YOUR_REQUESTS_PATH } from "@/lib/looking-for/paths";
import { closedAtFor, closeReasonOf, closingDay, requestOpenOn, type RequestFields } from "@/lib/looking-for/rules";
import { requestAutoClosedText } from "@/lib/looking-for/words";
import { sastDate } from "@/lib/time";
import type { LookingForRequest, OwnRequest, RequestState } from "@/lib/types";
import { deleteNotificationsAbout, notify } from "./notifications";
import { offerThreadCount } from "./offers";
import type { RequestRow } from "./rows";
import { sampleStore } from "./store";

// Looking For requests in the sample store (community actions spec 2.1, 2.6, 2.11, 2.14 and 2.23; plan decisions 1,
// 4, 6, 10 and 21). Plain functions over the store: lib/data/index.ts wraps the public reads in "use cache", tagged
// "requests"; Server Actions call the writes, then requestsChanged(). The asker is never part of what buyers see.
// Times come from the caller; only Server Actions call createRequest, which makes ids.
//
// Old requests close themselves (stage L spec decisions 8 to 16). Every reader that lists requests applies the rule by
// `today`, so it's right whether or not the close has been stored, and settleRequests(now) stores it the first time
// something request-time looks, telling the asker once. Nothing here that's called from "use cache" writes.

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
    closesOn: closingDay(row),
  };
}

const notHidden = (row: RequestRow) => row.hiddenAt === null;

function stateOf(row: RequestRow): RequestState {
  return row.hiddenAt !== null ? "hidden" : row.status;
}

/**
 * The asker's own view of a row on `today`, a SAST date: where it stands, and (stage L) when and how it closed, and
 * whether reopening it would take off a needed-by date that has passed (plan decision 13).
 */
function toOwn(row: RequestRow, today: string): OwnRequest {
  const auto = row.closedBy === "auto";
  return {
    request: toRequest(row),
    state: stateOf(row),
    hiddenReason: row.hiddenReason,
    closedAt: row.closedAt,
    closedAutomatically: auto,
    closeReason: auto ? closeReasonOf(row) : null,
    neededByPassed: row.neededBy !== null && row.neededBy < today,
  };
}

/**
 * The board's, the homepage's and the sitemap's: open on `today` (a SAST date) and not hidden, in the store's order
 * (plan decision 1). A request on or past its closing day is left out whether or not it has been settled (stage L).
 */
export function listedRequests(today: string): LookingForRequest[] {
  return [...sampleStore().requests.values()]
    .filter(notHidden)
    .map(toRequest)
    .filter((request) => requestOpenOn(request, today));
}

/** A request's page: anything not hidden, open or closed (spec 2.14). */
export function publicRequest(id: string): LookingForRequest | null {
  const row = sampleStore().requests.get(id);
  return row && notHidden(row) ? toRequest(row) : null;
}

/**
 * Whether the Hub has hidden this request: its page is gone but the request is not, so an offer thread can say who took
 * it down (plan amendment 19.4). False for one that has been deleted.
 */
export function requestIsHidden(id: string): boolean {
  const row = sampleStore().requests.get(id);
  return row !== undefined && !notHidden(row);
}

/** Every request with a page, for prerendering, open or closed (stage L keeps a closed request's page). */
export function publicRequestIds(): string[] {
  return [...sampleStore().requests.values()].filter(notHidden).map((row) => row.id);
}

/**
 * Stores the close of every open, unhidden request whose closing day has come (stage L spec decisions 11, 12 and 16),
 * and tells each asker once, in the app: `status` "closed", `closedAt` the start of the closing day in SAST, `closedBy`
 * "auto", `updatedAt` as it was. Every due row is marked in one pass before anything is awaited, so two renders at once
 * can't close a request twice or tell its asker twice, and a closed row is never settled again. A hidden request
 * waits until it's shown again; a sample one never closes. It writes, so request-time code only: never inside
 * "use cache". How many it closed, so a Server Action knows to call requestsChanged().
 */
export async function settleRequests(now: Date): Promise<number> {
  const today = sastDate(now);
  const closed: RequestRow[] = [];
  for (const row of sampleStore().requests.values()) {
    if (row.status !== "open" || row.hiddenAt !== null) continue;
    const day = closingDay(row);
    if (day === null || today < day) continue;
    row.status = "closed";
    row.closedAt = closedAtFor(day);
    row.closedBy = "auto";
    closed.push(row);
  }
  for (const row of closed) {
    if (row.askerId === null) continue;
    await notify({
      accountId: row.askerId,
      kind: "request-update",
      subjectId: row.id,
      text: requestAutoClosedText(row.title, closeReasonOf(row)),
      href: YOUR_REQUESTS_PATH,
      now,
    });
  }
  return closed.length;
}

/**
 * The asker's own request, or null when it isn't theirs or doesn't exist (their pages then answer 404). It settles
 * first, so a request whose closing day has come reads as closed (stage L spec decision 11).
 */
export async function getOwnRequest(askerId: string, id: string, now: Date): Promise<OwnRequest | null> {
  await settleRequests(now);
  const row = sampleStore().requests.get(id);
  return row && row.askerId === askerId ? toOwn(row, sastDate(now)) : null;
}

/** Who asked, for an offer's thread (spec 2.7): null for a sample request, which can't take offers, or one that's gone. */
export async function requestAskerId(id: string): Promise<string | null> {
  return sampleStore().requests.get(id)?.askerId ?? null;
}

const ORDER: Readonly<Record<RequestState, number>> = { open: 0, closed: 1, hidden: 2 };

/** Your requests (spec 2.13, plan decision 18): open, then closed, then hidden, each newest first. Settled first. */
export async function listOwnRequests(askerId: string, now: Date): Promise<OwnRequest[]> {
  await settleRequests(now);
  const today = sastDate(now);
  return [...sampleStore().requests.values()]
    .filter((row) => row.askerId === askerId)
    .sort((a, b) => ORDER[stateOf(a)] - ORDER[stateOf(b)] || b.createdAt.localeCompare(a.createdAt))
    .map((row) => toOwn(row, today));
}

/** How many of the account's requests are open (not hidden), for the limit of 5 (spec 2.5). Settled first (stage L). */
export async function countOpenRequests(askerId: string, now: Date): Promise<number> {
  await settleRequests(now);
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
    closedBy: null,
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

/**
 * Close (`open` false) or Reopen (`open` true) (spec 2.6). Null when there was nothing to do. Reopening starts a fresh
 * 30 days (its `updatedAt`) and takes off a needed-by date that has passed, which would close it again at the next
 * look (stage L spec decision 13); `neededByCleared` says it did, for the notice.
 */
export async function setRequestOpen(
  askerId: string,
  id: string,
  open: boolean,
  now: Date,
): Promise<(LookingForRequest & { neededByCleared: boolean }) | null> {
  const row = ownRow(askerId, id, open ? "closed" : "open");
  if (!row) return null;
  const at = now.toISOString();
  const neededByCleared = open && row.neededBy !== null && row.neededBy < sastDate(now);
  row.status = open ? "open" : "closed";
  row.closedAt = open ? null : at;
  row.closedBy = open ? null : "asker";
  row.updatedAt = at;
  if (neededByCleared) row.neededBy = null;
  return { ...toRequest(row), neededByCleared };
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

/**
 * Show again (stage J spec decision 14): the mirror of Hide the request. Its hide and reason are cleared; open or
 * closed stays as its asker left it (stage J plan decision 16). Null when it's gone or isn't hidden.
 */
export async function showRequest(id: string, now: Date): Promise<HiddenRequest | null> {
  const row = sampleStore().requests.get(id);
  if (!row || row.hiddenAt === null) return null;
  row.hiddenAt = null;
  row.hiddenReason = null;
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
  /** It closed by itself rather than by its asker (stage L spec decision 14). */
  closedAutomatically: boolean;
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
      closedAutomatically: row.closedBy === "auto",
      offers: row.seedOffers + offerThreadCount(row.id),
    }));
}
