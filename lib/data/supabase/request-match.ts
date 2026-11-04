import "server-only";
import { asMatchQuery } from "@/lib/looking-for/match";
import type { Json } from "@/lib/supabase/database.types";
import type * as Sample from "../request-match";
import { forServer } from "./clients";
import { iso, selectAll } from "./rows";

// A request's stored search on Supabase (AI stage G plan Task 4; planning decision 11): requests.match_query and
// match_read_at are closed to every API role, so every read and the one writer, save_request_match, go through the
// admin client. Matching itself stays in ../request-match with browse's listingMatches. Request-time only.

function failed(what: string, error: { code?: string }): never {
  throw new Error(`${what} failed (${error.code ?? "unknown"})`);
}

export const requestMatchCandidates: typeof Sample.requestMatchCandidates = async (campusSlug, today) => {
  const rows = await selectAll(
    () =>
      forServer()
        .from("requests")
        .select("id, title, asker_id, match_query, created_at")
        .eq("campus_slug", campusSlug)
        .eq("status", "open")
        .is("hidden_at", null)
        .not("asker_id", "is", null)
        .not("match_query", "is", null)
        .gt("closes_on", today),
    ["created_at", "id"],
  );
  return rows.flatMap((row) => {
    const query = asMatchQuery(row.match_query);
    return query && row.asker_id
      ? [{ id: row.id, title: row.title, askerId: row.asker_id, query, createdAt: iso(row.created_at) }]
      : [];
  });
};

export const saveRequestMatch: typeof Sample.saveRequestMatch = async (id, query, read) => {
  // `now` is the database's own now().
  const { data, error } = await forServer().rpc("save_request_match", {
    p_request: id,
    p_query: query as Json,
    p_read: read,
  });
  if (error) failed("save_request_match", error);
  return data === true;
};

export const requestMatchOf: typeof Sample.requestMatchOf = async (askerId, id) => {
  const { data, error } = await forServer()
    .from("requests")
    .select("match_query, match_read_at")
    .eq("id", id)
    .eq("asker_id", askerId)
    .maybeSingle();
  if (error) failed("requests", error);
  if (!data) return null;
  return { query: asMatchQuery(data.match_query), readAt: data.match_read_at === null ? null : iso(data.match_read_at) };
};

export const unreadRequests: typeof Sample.unreadRequests = async (today, limit) => {
  const { data, error } = await forServer()
    .from("requests")
    .select("id, title, category_slug, campus_slug, details, budget_zar, swap_welcome, needed_by")
    .eq("status", "open")
    .is("hidden_at", null)
    .not("asker_id", "is", null)
    .is("match_read_at", null)
    .gt("closes_on", today)
    .order("created_at")
    .order("id")
    .limit(limit);
  if (error) failed("requests", error);
  return data.map((row) => ({
    id: row.id,
    fields: {
      title: row.title,
      categorySlug: row.category_slug,
      campusSlug: row.campus_slug,
      details: row.details,
      budgetZar: row.budget_zar,
      swapWelcome: row.swap_welcome,
      neededBy: row.needed_by,
    },
  }));
};
