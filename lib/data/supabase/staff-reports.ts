import "server-only";
import type { OwnKind } from "@/lib/staff/own";
import type { ListingState, ReportOutcome, ReportReason, ReportTarget, SellerStatus } from "@/lib/types";
import { Refused } from "../refused";
import type { ReportRow } from "../rows";
import type * as Sample from "../staff-reports";
import { DELETED, type HiddenItem, type ReportLookups, reportViewOver } from "../staff-reports";
import { forViewer, type DbClient } from "./clients";
import { iso, selectAll } from "./rows";
import { myRequestIds, ownShopId } from "./staff-shops";
import { forViewerAs } from "./viewer";

// The Hub's reports queue and Show again's reads on Supabase (C4/C5 plan Task 15; decisions 2, 3 and 11). Everything
// is read as the admin, with their session: staff_reports (every report, with `own`: whose it is for the viewing admin,
// now or as recorded once the target has gone, Task 9b's report_own_kind), the listings, shops and requests reports
// name (an admin reads every one, hidden ones included), staff_seller_profiles for the shops' standing, and first
// names. The view is the sample's own rules over those rows (reportViewOver).
//
// Dismiss is dismiss_report, which closes the report, writes the entry and tells the reporter in one transaction. The
// Hub's hide and pause functions close the reports on what they hide or pause themselves, so closeReportsOn and
// closeReportsAboutShop throw: a follow-up left outside sampleFollowUps fails loudly. Request-time only, never cached.

function failed(what: string, error: { code?: string }): never {
  throw new Error(`${what} failed (${error.code ?? "unknown"})`);
}

const REPORT_COLUMNS =
  "id, reporter_id, target_kind, target_id, target_title, reason, detail, status, created_at, outcome, note, closed_at, closed_by, target_gone, own";

type ReportRecord = {
  id: string | null;
  reporter_id: string | null;
  target_kind: string | null;
  target_id: string | null;
  target_title: string | null;
  reason: string | null;
  detail: string | null;
  status: string | null;
  created_at: string | null;
  outcome: string | null;
  note: string | null;
  closed_at: string | null;
  closed_by: string | null;
  target_gone: boolean | null;
  own: string | null;
};

/** A staff_reports row as the store's ReportRow. The recorded owner stays in the database: `own` answers for it. */
function reportRowFrom(row: ReportRecord): ReportRow {
  return {
    id: row.id!,
    reporterId: row.reporter_id!,
    targetKind: row.target_kind as ReportTarget["kind"],
    targetId: row.target_id!,
    targetTitle: row.target_title!,
    reason: row.reason as ReportReason,
    detail: row.detail ?? "",
    status: row.status as ReportRow["status"],
    createdAt: iso(row.created_at!),
    outcome: row.outcome as ReportOutcome | null,
    note: row.note,
    closedAt: iso(row.closed_at),
    closedBy: row.closed_by,
    targetGone: row.target_gone === true,
    targetOwnerId: null,
  };
}

/** Rows of `table` whose `column` is one of `values`, a hundred values a request (an address has a length limit). */
async function rowsIn<Row>(read: (values: string[]) => PromiseLike<{ data: Row[] | null; error: { code?: string } | null }>, values: readonly string[], what: string): Promise<Row[]> {
  const unique = [...new Set(values)];
  const rows: Row[] = [];
  for (let from = 0; from < unique.length; from += 100) {
    const { data, error } = await read(unique.slice(from, from + 100));
    if (error) failed(what, error);
    rows.push(...(data ?? []));
  }
  return rows;
}

/** The lookups for these reports: the targets they name, the shops' standing, first names and `own`. */
async function lookupsFor(client: DbClient, records: readonly ReportRecord[]): Promise<ReportLookups> {
  const ids = (kind: string) => records.flatMap((row) => (row.target_kind === kind && row.target_id ? [row.target_id] : []));
  const [listings, requests] = await Promise.all([
    rowsIn((chunk) => client.from("listings").select("id, shop_id, hidden_at").in("id", chunk), ids("listing"), "listings"),
    rowsIn((chunk) => client.from("requests").select("id, hidden_at").in("id", chunk), ids("request"), "requests"),
  ]);
  const shopIds = listings.map((row) => row.shop_id);
  const [byId, bySlug] = await Promise.all([
    rowsIn((chunk) => client.from("shops").select("id, slug, name").in("id", chunk), shopIds, "shops"),
    rowsIn((chunk) => client.from("shops").select("id, slug, name").in("slug", chunk), ids("seller"), "shops"),
  ]);
  const shops = new Map([...byId, ...bySlug].map((row) => [row.slug, row]));
  const slugOf = new Map([...shops.values()].map((row) => [row.id, row.slug]));
  const profiles = await rowsIn(
    (chunk) => client.from("staff_seller_profiles").select("shop_id, status, paused_by").in("shop_id", chunk),
    [...shops.values()].map((row) => row.id),
    "staff_seller_profiles",
  );
  const people = records.flatMap((row) => [row.reporter_id, row.closed_by].filter((id): id is string => id !== null));
  const names = new Map(
    (await rowsIn((chunk) => client.from("profiles").select("id, first_name").in("id", chunk), people, "profiles")).map(
      (row) => [row.id, row.first_name],
    ),
  );
  const listingById = new Map(listings.map((row) => [row.id, row]));
  const requestById = new Map(requests.map((row) => [row.id, row]));
  const profileBySlug = new Map(profiles.flatMap((row) => (row.shop_id && slugOf.has(row.shop_id) ? [[slugOf.get(row.shop_id)!, row]] : [])));
  const ownOf = new Map(records.map((row) => [row.id, row.own as OwnKind | null]));
  return {
    listing(id) {
      const row = listingById.get(id);
      const sellerSlug = row ? slugOf.get(row.shop_id) : undefined;
      return row && sellerSlug ? { sellerSlug, hiddenAt: iso(row.hidden_at) } : undefined;
    },
    shop: (slug) => shops.get(slug),
    request(id) {
      const row = requestById.get(id);
      return row ? { hiddenAt: iso(row.hidden_at) } : undefined;
    },
    profileOf(slug) {
      const row = profileBySlug.get(slug);
      return row ? { status: row.status as SellerStatus, pausedBy: row.paused_by as "seller" | "staff" | null } : undefined;
    },
    firstName: (accountId) => (accountId ? names.get(accountId) : undefined) ?? DELETED,
    // staff_reports.own, read with the viewer's session: whose it is now, or once it has gone, whose it was.
    own: (row) => ownOf.get(row.id) ?? null,
  };
}

async function views(client: DbClient, records: readonly ReportRecord[], viewerId: string | null) {
  if (records.length === 0) return [];
  const view = reportViewOver(await lookupsFor(client, records));
  return records.map((row) => view(reportRowFrom(row), viewerId));
}

/** The queue: open reports oldest first, then the 50 most recently closed. It names no owner (no viewer). */
export const listReports: typeof Sample.listReports = async () => {
  const client = await forViewer();
  const [open, closed] = await Promise.all([
    selectAll(() => client.from("staff_reports").select(REPORT_COLUMNS).eq("status", "open"), ["created_at", "id"]),
    client
      .from("staff_reports")
      .select(REPORT_COLUMNS)
      .eq("status", "closed")
      .order("closed_at", { ascending: false })
      .order("id")
      .limit(50),
  ]);
  if (closed.error) failed("staff_reports", closed.error);
  return views(client, [...open, ...closed.data], null);
};

/**
 * A report for its page. `viewerId` must be the signed-in admin before the view's `own` is used (decision 2): the
 * view answers for whoever is signed in.
 */
export const getReport: typeof Sample.getReport = async (id, viewerId = null) => {
  const client = viewerId === null ? await forViewer() : await forViewerAs(viewerId);
  const { data, error } = await client.from("staff_reports").select(REPORT_COLUMNS).eq("id", id).maybeSingle();
  if (error) failed("staff_reports", error);
  return data ? ((await views(client, [data], viewerId))[0] ?? null) : null;
};

export const openReportCount: typeof Sample.openReportCount = async () => {
  const { count, error } = await (await forViewer())
    .from("staff_reports")
    .select("id", { count: "exact", head: true })
    .eq("status", "open");
  if (error) failed("staff_reports", error);
  return count ?? 0;
};

/** Dismiss: dismiss_report closes it, logs it and tells the reporter (decision 3). Null when it wasn't open. */
export const closeReport: typeof Sample.closeReport = async (id, note) => {
  const client = await forViewer();
  const { data, error } = await client.rpc("dismiss_report", { p_report: id, p_note: note });
  if (error) failed("dismiss_report", error);
  if (data === "nothing") return null;
  if (data === "own-shop" || data === "own-request" || data === "forbidden") throw new Refused(data);
  if (data !== "changed") throw new Error(`dismiss_report answered ${data}`);
  const report = await client.from("staff_reports").select("id, reporter_id, target_title").eq("id", id).single();
  if (report.error) failed("staff_reports", report.error);
  return { id: report.data.id!, reporterId: report.data.reporter_id!, title: report.data.target_title! };
};

export const closeReportsOn: typeof Sample.closeReportsOn = async () => {
  throw new Error("closeReportsOn: on Supabase the staff function closed them (hide_listing, hide_request)");
};

export const closeReportsAboutShop: typeof Sample.closeReportsAboutShop = async () => {
  throw new Error("closeReportsAboutShop: on Supabase the staff function closed them (staff_pause_shop)");
};

// --- Hidden listings and requests (stage J spec decision 14) -------------------------------------------------------

/** What's hidden, as the admin reads it, with `own` for the viewer's: their shop's id once, their requests' ids once. */
async function hidden(viewerId: string | null, only?: { kind: "listing" | "request"; id: string }) {
  const client = viewerId === null ? await forViewer() : await forViewerAs(viewerId);
  const listingsQuery = () => {
    const query = client.from("listings").select("id, title, shop_id, campus_slug, hidden_at, hidden_reason, state").not("hidden_at", "is", null);
    return only ? query.eq("id", only.id) : query;
  };
  const requestsQuery = () => {
    const query = client.from("requests").select("id, title, campus_slug, hidden_at, hidden_reason, status").not("hidden_at", "is", null);
    return only ? query.eq("id", only.id) : query;
  };
  const [listings, requests, ownShop, ownRequests] = await Promise.all([
    only?.kind === "request" ? [] : selectAll(listingsQuery, ["id"]),
    only?.kind === "listing" ? [] : selectAll(requestsQuery, ["id"]),
    viewerId === null ? null : ownShopId(client, viewerId),
    viewerId === null ? new Set<string>() : myRequestIds(client),
  ]);
  const shopIds = listings.map((row) => row.shop_id);
  const [shops, profiles] = await Promise.all([
    rowsIn((chunk) => client.from("shops").select("id, slug, name").in("id", chunk), shopIds, "shops"),
    rowsIn((chunk) => client.from("staff_seller_profiles").select("shop_id, status, paused_by").in("shop_id", chunk), shopIds, "staff_seller_profiles"),
  ]);
  const shopById = new Map(shops.map((row) => [row.id, row]));
  const pausedByHub = new Set(profiles.flatMap((row) => (row.status === "paused" && row.paused_by === "staff" && row.shop_id ? [row.shop_id] : [])));
  const listingItems: HiddenItem[] = listings.map((row) => ({
    kind: "listing",
    id: row.id,
    title: row.title,
    shopName: shopById.get(row.shop_id)?.name ?? shopById.get(row.shop_id)?.slug ?? null,
    campusSlug: row.campus_slug,
    hiddenAt: iso(row.hidden_at!),
    reason: row.hidden_reason ?? "",
    listingState: row.state as ListingState,
    shopPausedByHub: pausedByHub.has(row.shop_id),
    requestClosed: false,
    own: ownShop !== null && row.shop_id === ownShop,
  }));
  const requestItems: HiddenItem[] = requests.map((row) => ({
    kind: "request",
    id: row.id,
    title: row.title,
    shopName: null,
    campusSlug: row.campus_slug,
    hiddenAt: iso(row.hidden_at!),
    reason: row.hidden_reason ?? "",
    listingState: null,
    shopPausedByHub: false,
    requestClosed: row.status === "closed",
    own: ownRequests.has(row.id),
  }));
  return { listings: listingItems, requests: requestItems };
}

const newestHiddenFirst = (a: HiddenItem, b: HiddenItem) => b.hiddenAt.localeCompare(a.hiddenAt);

export const listHidden: typeof Sample.listHidden = async (viewerId = null) => {
  const { listings, requests } = await hidden(viewerId);
  return { listings: listings.sort(newestHiddenFirst), requests: requests.sort(newestHiddenFirst) };
};

export const getHidden: typeof Sample.getHidden = async (kind, id, viewerId = null) => {
  const found = await hidden(viewerId, { kind, id });
  return (kind === "listing" ? found.listings : found.requests)[0] ?? null;
};

export const countHidden: typeof Sample.countHidden = async () => {
  const client = await forViewer();
  const [listings, requests] = await Promise.all([
    client.from("listings").select("id", { count: "exact", head: true }).not("hidden_at", "is", null),
    client.from("requests").select("id", { count: "exact", head: true }).not("hidden_at", "is", null),
  ]);
  if (listings.error) failed("listings", listings.error);
  if (requests.error) failed("requests", requests.error);
  return { listings: listings.count ?? 0, requests: requests.count ?? 0 };
};
