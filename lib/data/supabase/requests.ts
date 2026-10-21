import "server-only";
import type { RequestFields } from "@/lib/looking-for/rules";
import { sastDate } from "@/lib/time";
import type { LookingForRequest, RequestStatus } from "@/lib/types";
import { Refused, type RefusalCode } from "../refused";
import type * as Sample from "../requests";
import { ORDER, ownView, requestExport, settleRequests as settle } from "../requests";
import { forPublic, forServer, forViewer, type DbClient } from "./clients";
import { type AsyncTwin, iso, selectAll } from "./rows";
import { forViewerAs } from "./viewer";

// Looking For requests on Supabase (2b plan Task 17; decisions 1 to 3 and 21): the sample module's public reads, over
// the request_cards view (requests the Hub hasn't hidden, with their closing day and offer count, never the asker),
// through the cookieless client; lib/data/index.ts wraps them in "use cache", tagged `requests`. The settle is the
// database's settle_requests, through the admin client, from request-time code only.
//
// The asker's side (C4/C5 plan Task 4; decisions 2, 6 to 8): their own reads come from my_requests through their own
// session, each settling first as the sample does; the writes are save_request, set_request_open and delete_request
// with that session, and the Hub's hide_request and show_request with the admin's. Results the sample's shapes can't
// carry throw Refused. Only the shared mappers in ../requests (ownView, ORDER, requestExport) decide what a row says.

const CARD_COLUMNS =
  "id, title, category_slug, campus_slug, details, budget_zar, swap_welcome, needed_by, status, created_at, offers, closes_on";

type Card = {
  id: string | null;
  title: string | null;
  category_slug: string | null;
  campus_slug: string | null;
  details: string | null;
  budget_zar: number | null;
  swap_welcome: boolean | null;
  needed_by: string | null;
  status: string | null;
  created_at: string | null;
  offers: number | null;
  closes_on: string | null;
};

/** A card as part B's LookingForRequest: the offers are the view's (offer threads plus the sample's number). */
function toRequest(card: Card): LookingForRequest[] {
  if (!card.id || !card.title || !card.category_slug || !card.campus_slug || card.details === null || !card.created_at) {
    return [];
  }
  return [
    {
      id: card.id,
      title: card.title,
      campusSlug: card.campus_slug,
      offers: card.offers ?? 0,
      details: card.details,
      categorySlug: card.category_slug,
      budgetZar: card.budget_zar,
      swapWelcome: card.swap_welcome ?? false,
      neededBy: card.needed_by,
      createdAt: iso(card.created_at),
      status: card.status as RequestStatus,
      closesOn: card.closes_on,
    },
  ];
}

/**
 * The board's, the homepage's and the sitemap's: open on `today` (a SAST date), settled or not (stage L decision 10),
 * oldest first, as the store adds them (the readers sort them newest first).
 */
export const listedRequests: AsyncTwin<typeof Sample.listedRequests> = async (today) => {
  const cards = await selectAll(
    () =>
      forPublic()
        .from("request_cards")
        .select(CARD_COLUMNS)
        .eq("status", "open")
        .or(`closes_on.is.null,closes_on.gt.${today}`),
    ["created_at", "id"],
  );
  return cards.flatMap(toRequest);
};

/** A request's page: anything not hidden, open or closed (community actions spec 2.14). */
export const publicRequest: AsyncTwin<typeof Sample.publicRequest> = async (id) => {
  const { data, error } = await forPublic().from("request_cards").select(CARD_COLUMNS).eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? (toRequest(data)[0] ?? null) : null;
};

/** Every request with a page, for prerendering, open or closed. */
export const publicRequestIds: AsyncTwin<typeof Sample.publicRequestIds> = async () => {
  const rows = await selectAll(() => forPublic().from("request_cards").select("id, created_at"), ["created_at", "id"]);
  return rows.flatMap((row) => (row.id ? [row.id] : []));
};

/**
 * Stores every due close and the one reminder, telling each asker (decision 2): the database's settle_requests, which
 * holds a lock and caps the time at its own now(). The admin client: request-time code only, never inside
 * "use cache" (decision 21). How many it closed.
 */
export const settleRequests: typeof Sample.settleRequests = async (now) => {
  const { data, error } = await forServer().rpc("settle_requests", { p_now: now.toISOString() });
  if (error) throw new Error(error.message);
  return data;
};

// --- The asker's side (C4/C5 plan Task 4) ------------------------------------------------------------------------------

const OWN_COLUMNS =
  "id, title, category_slug, campus_slug, details, budget_zar, swap_welcome, needed_by, status, created_at, offers, " +
  "closes_on, closed_at, closed_by, hidden_at, hidden_reason";

type OwnRow = Card & {
  closed_at: string | null;
  closed_by: string | null;
  hidden_at: string | null;
  hidden_reason: string | null;
};

function failed(what: string, error: { code?: string }): never {
  throw new Error(`${what} failed (${error.code ?? "unknown"})`);
}

/** The parts of a my_requests row the asker's view reads besides the request. */
function partsOf(row: OwnRow): Sample.OwnParts {
  return {
    hiddenAt: row.hidden_at === null ? null : iso(row.hidden_at),
    hiddenReason: row.hidden_reason,
    status: row.status as RequestStatus,
    closedAt: row.closed_at === null ? null : iso(row.closed_at),
    closedBy: row.closed_by as Sample.OwnParts["closedBy"],
    neededBy: row.needed_by,
  };
}

/** A my_requests row as the asker's view, on `today`, through the sample's own rule (ownView). */
function toOwnFrom(row: OwnRow, today: string) {
  const request = toRequest(row)[0];
  return request ? [ownView(request, partsOf(row), today)] : [];
}

/** The asker's rows, every state, in no order. */
async function ownRows(client: DbClient): Promise<OwnRow[]> {
  return selectAll(() => client.from("my_requests").select(OWN_COLUMNS), ["created_at", "id"]) as Promise<OwnRow[]>;
}

/** One of the asker's rows, or null. */
async function ownRow(client: DbClient, id: string): Promise<OwnRow | null> {
  const { data, error } = await client.from("my_requests").select(OWN_COLUMNS).eq("id", id).maybeSingle();
  if (error) failed("my_requests", error);
  return data as OwnRow | null;
}

/** The asker's own request, settled first (stage L decision 11); null when it isn't theirs or doesn't exist. */
export const getOwnRequest: typeof Sample.getOwnRequest = async (askerId, id, now) => {
  await settle(now);
  const row = await ownRow(await forViewerAs(askerId), id);
  return row ? (toOwnFrom(row, sastDate(now))[0] ?? null) : null;
};

/** Your requests: open, then closed, then hidden, each newest first. Settled first. */
export const listOwnRequests: typeof Sample.listOwnRequests = async (askerId, now) => {
  await settle(now);
  const today = sastDate(now);
  return (await ownRows(await forViewerAs(askerId)))
    .flatMap((row) => toOwnFrom(row, today))
    .sort((a, b) => ORDER[a.state] - ORDER[b.state] || b.request.createdAt.localeCompare(a.request.createdAt));
};

/** How many of the asker's requests are open and shown, for the limit of 5. Settled first. */
export const countOpenRequests: typeof Sample.countOpenRequests = async (askerId, now) => {
  await settle(now);
  const { count, error } = await (await forViewerAs(askerId))
    .from("my_requests")
    .select("id", { count: "exact", head: true })
    .eq("state", "open");
  if (error) failed("my_requests", error);
  return count ?? 0;
};

/** How many of the asker's requests made since `since` are still there (the daily limit). */
export const countRequestsSince: typeof Sample.countRequestsSince = async (askerId, since) => {
  const { count, error } = await (await forViewerAs(askerId))
    .from("my_requests")
    .select("id", { count: "exact", head: true })
    .gt("created_at", since.toISOString());
  if (error) failed("my_requests", error);
  return count ?? 0;
};

/** Who asked, for an offer's composer (decision 9): one row through the admin client, compared, never shown. */
export const requestAskerId: typeof Sample.requestAskerId = async (id) => {
  const { data, error } = await forServer().from("requests").select("asker_id").eq("id", id).maybeSingle();
  if (error) failed("requests", error);
  return data?.asker_id ?? null;
};

/** save_request's refusals the sample's shapes have no room for. */
const SAVE_REFUSALS: readonly RefusalCode[] = ["open-limit", "daily-limit", "once-expired", "once-taken"];

/** The generated types say string where SQL takes null too. */
const orNull = <T>(value: T | null) => value as T;

function saveArgs(fields: RequestFields) {
  return {
    p_title: fields.title,
    p_category_slug: fields.categorySlug,
    p_campus_slug: fields.campusSlug,
    p_details: fields.details,
    p_budget_zar: orNull(fields.budgetZar),
    p_swap_welcome: fields.swapWelcome,
    p_needed_by: orNull(fields.neededBy),
  };
}

/** The request as it's now stored, read back through the asker's own view. */
async function readBack(client: DbClient, id: string): Promise<LookingForRequest> {
  const row = await ownRow(client, id);
  const request = row ? toRequest(row)[0] : undefined;
  if (!request) throw new Error("save_request saved a request its asker can't read");
  return request;
}

/**
 * Post request (decisions 6 and 7): save_request takes the form's one-time token and counts the limits under the
 * asker's lock, in the same transaction as the insert. A repeat, a made-up or run-out token, or a limit met by a race
 * throws Refused, which the action shows as its own check would.
 */
export const createRequest: typeof Sample.createRequest = async ({ askerId, fields, onceToken }) => {
  const client = await forViewerAs(askerId);
  const { data, error } = await client.rpc("save_request", {
    p_id: orNull<string>(null),
    ...saveArgs(fields),
    p_once_token: orNull(onceToken ?? null),
  });
  if (error) failed("save_request", error);
  const answer = data as { result: string; id?: string };
  if (answer.result === "posted" && answer.id) return readBack(client, answer.id);
  if (SAVE_REFUSALS.includes(answer.result as RefusalCode)) throw new Refused(answer.result as RefusalCode);
  throw new Error(`save_request answered ${answer.result}`);
};

/** Save changes: only the asker's open request; null otherwise. */
export const updateRequest: typeof Sample.updateRequest = async (askerId, id, fields) => {
  const client = await forViewerAs(askerId);
  const { data, error } = await client.rpc("save_request", { p_id: id, ...saveArgs(fields) });
  if (error) failed("save_request", error);
  const answer = data as { result: string; id?: string };
  if (answer.result === "saved" && answer.id) return readBack(client, answer.id);
  if (answer.result === "not-open" || answer.result === "not-found") return null;
  throw new Error(`save_request answered ${answer.result}`);
};

/**
 * Close or Reopen, settled first (decision 8; Task 9b's note): set_request_open treats a due request it hasn't settled
 * as still open, so without the settle a Close would record the asker's close of a request that had closed itself.
 * Null when there was nothing to do; a race past the 5 open throws Refused("reopen-limit").
 */
export const setRequestOpen: typeof Sample.setRequestOpen = async (askerId, id, open, now) => {
  await settle(now);
  const client = await forViewerAs(askerId);
  const { data, error } = await client.rpc("set_request_open", { p_id: id, p_open: open });
  if (error) failed("set_request_open", error);
  if (data === "nothing") return null;
  if (data === "reopen-limit") throw new Refused("reopen-limit");
  if (data !== "closed" && data !== "reopened" && data !== "reopened-date-cleared") {
    throw new Error(`set_request_open answered ${data}`);
  }
  return { ...(await readBack(client, id)), neededByCleared: data === "reopened-date-cleared" };
};

/** Delete, in any state; its Hub notifications go with it (delete_request). */
export const deleteRequest: typeof Sample.deleteRequest = async (askerId, id) => {
  const { data, error } = await (await forViewerAs(askerId)).rpc("delete_request", { p_id: id });
  if (error) failed("delete_request", error);
  return data === "deleted";
};

/** A staff function's answer that the sample's null or result can't say (decision 2), or one it never gives. */
function refusedBy(fn: string, answer: string): never {
  if (answer === "own-request" || answer === "forbidden") throw new Refused(answer);
  throw new Error(`${fn} answered ${answer}`);
}

/** The request's title, read back with the admin's own session (admins read every request, hidden ones too). */
async function hiddenRequest(client: DbClient, id: string): Promise<Sample.HiddenRequest> {
  const { data, error } = await client.from("requests").select("id, title").eq("id", id).single();
  if (error) failed("requests", error);
  // The asker is the function's to tell, and no API role reads who asked (decision 2's note): the follow-ups that use
  // it run on the sample store only.
  return { id: data.id, title: data.title, askerId: null };
}

/**
 * The Hub's Hide the request, as the signed-in admin, settled first (decision 8; Task 9b's note: hide_request doesn't
 * settle, and treats a due request as open). hide_request closes the reports, writes the audit row and tells the
 * asker and the reporters in its own transaction (decision 3). Null when it's gone, hidden already, or no report is
 * open; the admin's own request, or a role that has gone, throws Refused.
 */
export const hideRequest: typeof Sample.hideRequest = async (id, reason, now) => {
  await settle(now);
  const client = await forViewer();
  const { data, error } = await client.rpc("hide_request", { p_request: id, p_reason: reason });
  if (error) failed("hide_request", error);
  if (data === "changed") return hiddenRequest(client, id);
  if (data === "nothing" || data === "no-open-report") return null;
  return refusedBy("hide_request", data);
};

/** Show again (a hidden request is never settled, so no settle here). */
export const showRequest: typeof Sample.showRequest = async (id) => {
  const client = await forViewer();
  const { data, error } = await client.rpc("show_request", { p_request: id });
  if (error) failed("show_request", error);
  if (data === "changed") return hiddenRequest(client, id);
  if (data === "nothing") return null;
  return refusedBy("show_request", data);
};

/** Deleting an account's requests is forget_account's (phase B's deleteAccountData; decision 16). */
export const forgetRequestsOf: typeof Sample.forgetRequestsOf = async () => {
  throw new Error("forgetRequestsOf: forget_account does this on Supabase (phase B's deleteAccountData)");
};

/** The asker's requests for the download, newest first, with no ids. The caller settles first (exportAccountData). */
export const exportRequests: typeof Sample.exportRequests = async (accountId) => {
  const rows = await ownRows(await forViewerAs(accountId));
  return rows
    .sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? "") || (b.id ?? "").localeCompare(a.id ?? ""))
    .flatMap((row) => {
      if (!row.title || !row.category_slug || !row.campus_slug || row.details === null || !row.created_at) return [];
      return [
        requestExport(
          {
            title: row.title,
            categorySlug: row.category_slug,
            campusSlug: row.campus_slug,
            details: row.details,
            budgetZar: row.budget_zar,
            swapWelcome: row.swap_welcome ?? false,
            createdAt: iso(row.created_at),
            ...partsOf(row),
          },
          row.offers ?? 0,
        ),
      ];
    });
};
