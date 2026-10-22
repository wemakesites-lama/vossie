import "server-only";
import { MENTOR_WINDOW_DAYS, mentorFlags } from "@/lib/staff/mentor";
import type { MentoredShop, SellerStatus, TrustBadge } from "@/lib/types";
import type * as Sample from "../mentors";
import { Refused, type RefusalCode } from "../refused";
import { currentOf, recentCounts } from "../shop-stats";
import { forViewer, type DbClient } from "./clients";
import { iso, selectAll } from "./rows";
import { forViewerAs } from "./viewer";

// The mentor dashboard on Supabase (C4/C5 plan Task 19; decisions 2, 6 and 16). Everything is read with the viewer's
// own session, so the access rules decide who sees what: staff_seller_profiles gives a mentor the open shops assigned
// to them and an admin every one; mentor_notes gives the shop's mentor and admins the notes about its owner, never the
// owner themselves, an admin who sells included (private.can_mentor), which is also what keeps notes out of the data
// download. The viewer's own shop is left out, as the sample does (amendment 15.3). The 14-day numbers are C1's
// recentCounts (the admin client, request-time). A note or check-in is add_mentor_note or add_check_in with the
// author's session, which takes the form's one-time token and writes the audit entry in the same transaction
// (decisions 3 and 6). Request-time only, never cached.

const DELETED = "Deleted account";

function failed(what: string, error: { code?: string }): never {
  throw new Error(`${what} failed (${error.code ?? "unknown"})`);
}

/** First names by account id, a hundred ids a request (staff read every profile). */
async function firstNames(client: DbClient, ids: readonly string[]): Promise<Map<string, string>> {
  const names = new Map<string, string>();
  const unique = [...new Set(ids)];
  for (let from = 0; from < unique.length; from += 100) {
    const { data, error } = await client.from("profiles").select("id, first_name").in("id", unique.slice(from, from + 100));
    if (error) failed("profiles", error);
    for (const row of data) names.set(row.id, row.first_name);
  }
  return names;
}

export const mentoredShops: typeof Sample.mentoredShops = async (viewer, now) => {
  const client = await forViewerAs(viewer.id);
  const profiles = (
    await selectAll(
      () =>
        client
          .from("staff_seller_profiles")
          .select("account_id, status, shop_id, paused_by, mentor_id")
          .not("mentor_id", "is", null)
          .neq("status", "pending")
          .not("shop_id", "is", null),
      ["account_id"],
    )
  ).filter((row) => row.account_id !== viewer.id);
  if (profiles.length === 0) return [];
  const shopIds = profiles.map((row) => row.shop_id!);
  const shops = new Map<string, { slug: string; name: string; campus_slug: string; badge: string | null }>();
  for (let from = 0; from < shopIds.length; from += 100) {
    const { data, error } = await client
      .from("shops")
      .select("id, slug, name, campus_slug, badge")
      .in("id", shopIds.slice(from, from + 100));
    if (error) failed("shops", error);
    for (const row of data) shops.set(row.id, row);
  }
  const names = await firstNames(
    client,
    profiles.flatMap((row) => [row.account_id!, row.mentor_id!]),
  );
  const rows: MentoredShop[] = [];
  for (const profile of profiles) {
    const shop = shops.get(profile.shop_id!);
    const ownerName = names.get(profile.account_id!);
    if (!shop || ownerName === undefined) continue;
    const status = profile.status as SellerStatus;
    const counts = currentOf(await recentCounts(shop.slug, MENTOR_WINDOW_DAYS, now));
    rows.push({
      slug: shop.slug,
      name: shop.name,
      campusSlug: shop.campus_slug,
      ownerName,
      ownerId: profile.account_id!,
      badge: shop.badge as TrustBadge | null,
      status,
      pausedBy: status === "paused" ? ((profile.paused_by as "seller" | "staff" | null) ?? null) : null,
      mentorId: profile.mentor_id!,
      mentorName: names.get(profile.mentor_id!) ?? DELETED,
      counts,
      flags: mentorFlags(counts, status),
    });
  }
  return rows.sort((a, b) => a.name.localeCompare(b.name));
};

/** What's been written about a shop's owner, newest first: only for their shop's mentor and admins, never the owner. */
export const listNotes: typeof Sample.listNotes = async (ownerId) => {
  const client = await forViewer();
  const rows = await selectAll(
    () => client.from("mentor_notes").select("id, kind, check_in_on, text, author_name, created_at").eq("owner_id", ownerId),
    ["id"],
  );
  rows.sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at) || b.id.localeCompare(a.id));
  return rows.map((row) => ({
    id: row.id,
    kind: row.kind as "note" | "check-in",
    checkInOn: row.check_in_on,
    text: row.text,
    authorName: row.author_name,
    createdAt: iso(row.created_at),
  }));
};

/** The functions' answers that the sample's id has no room for (decision 2). */
const NOTE_REFUSALS: readonly RefusalCode[] = ["forbidden", "once-expired", "once-taken", "check-in-day-future"];

/**
 * A note or check-in, with the author's session and the form's one-time token (decision 6). The new note's id, read
 * back: the author's newest about that owner.
 */
export const addNote: typeof Sample.addNote = async ({ ownerId, kind, checkInOn, text, author }, onceToken) => {
  const client = await forViewerAs(author.id);
  const token = (onceToken ?? null) as string;
  const { data, error } =
    kind === "note"
      ? await client.rpc("add_mentor_note", { p_owner: ownerId, p_text: text, p_once_token: token })
      : await client.rpc("add_check_in", { p_owner: ownerId, p_day: checkInOn as string, p_text: text, p_once_token: token });
  if (error) failed(kind === "note" ? "add_mentor_note" : "add_check_in", error);
  if (NOTE_REFUSALS.includes(data as RefusalCode)) throw new Refused(data as RefusalCode);
  if (data !== "changed") throw new Error(`${kind === "note" ? "add_mentor_note" : "add_check_in"} answered ${String(data)}`);
  const made = await client
    .from("mentor_notes")
    .select("id")
    .eq("owner_id", ownerId)
    .eq("author_id", author.id)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(1)
    .single();
  if (made.error) failed("mentor_notes", made.error);
  return made.data.id;
};
