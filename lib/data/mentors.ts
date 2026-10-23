import { randomUUID } from "node:crypto";
import { onSupabase } from "@/lib/backend";
import { byNeed, MENTOR_WINDOW_DAYS, mentorFlags } from "@/lib/staff/mentor";
import { isAdmin } from "@/lib/staff/roles";
import { sastDate } from "@/lib/time";
import type { Account, MentoredShop } from "@/lib/types";
import type { MentorNoteRow, SellerProfileRow } from "./rows";
import { currentOf, recentCounts } from "./shop-stats";
import { sampleStore } from "./store";

// The mentor dashboard's data (staff tools spec 2.6; plan decisions 15 and 16; role views spec 6 and 7.3). A mentor
// sees the shops assigned to them; an admin sees every assigned shop; nobody sees their own. Each has its last 14 days'
// numbers, its flags and its last check-in's day, most in need first: numbers, never messages (FUNCTION-MAP K1), and a
// check-in's day, never what was said. Notes and check-ins are about the shop's owner, shared with every mentor and
// admin who can open the shop's page, and never shown to the seller. Times come from the caller.
//
// On Supabase (C4/C5 plan Task 19) mentoredShops, lastCheckIns, listNotes and addNote are lib/data/supabase/mentors.ts's,
// picked by their first line through import(); getMentoredShop goes through mentoredShops.

const supabase = () => import("./supabase/mentors");

const DELETED = "Deleted account";

type Viewer = Pick<Account, "id" | "roles">;

/**
 * Whether `viewer` may follow the shop on this seller profile, private.can_mentor's rule (amendment 15.3): it has a
 * mentor, isn't waiting and has a shop; the viewer isn't its owner, and is its mentor still holding the role, or an
 * admin.
 */
function mayMentor(
  viewer: Viewer,
  profile: SellerProfileRow | undefined,
): profile is SellerProfileRow & { mentorId: string; sellerSlug: string } {
  if (!profile?.mentorId || profile.status === "pending" || !profile.sellerSlug) return false;
  if (profile.accountId === viewer.id) return false;
  return isAdmin(viewer) || (profile.mentorId === viewer.id && viewer.roles.includes("mentor"));
}

/** The shops `viewer` may follow (plan decision 15): theirs, or for an admin every assigned shop. Most in need first. */
export async function mentoredShops(viewer: Viewer, now: Date): Promise<MentoredShop[]> {
  if (onSupabase()) return (await supabase()).mentoredShops(viewer, now);
  const { sellerProfiles, sellers, accounts, listings } = sampleStore();
  // Listings a buyer could ask about: available, and not hidden by the Hub.
  const available = new Map<string, number>();
  for (const listing of listings.values()) {
    if (listing.state !== "available" || listing.hiddenAt) continue;
    available.set(listing.sellerSlug, (available.get(listing.sellerSlug) ?? 0) + 1);
  }
  const rows: MentoredShop[] = [];
  for (const profile of sellerProfiles.values()) {
    if (!mayMentor(viewer, profile)) continue;
    const shop = sellers.get(profile.sellerSlug);
    const owner = accounts.get(profile.accountId);
    if (!shop || !owner) continue;
    // The current window alone (N2's currentOf): the shop page reads the window before itself (Task 10).
    const counts = currentOf(await recentCounts(shop.slug, MENTOR_WINDOW_DAYS, now));
    const pausedBy = profile.status === "paused" ? (profile.pausedBy ?? null) : null;
    rows.push({
      slug: shop.slug,
      name: shop.name,
      campusSlug: shop.campusSlug,
      ownerName: owner.firstName,
      ownerId: owner.id,
      badge: shop.badge,
      status: profile.status,
      pausedBy,
      mentorId: profile.mentorId,
      mentorName: accounts.get(profile.mentorId)?.firstName ?? DELETED,
      counts,
      flags: mentorFlags({
        counts,
        status: profile.status,
        pausedBy,
        availableListings: available.get(shop.slug) ?? 0,
      }),
      lastCheckInOn: null,
    });
  }
  const checkIns = await lastCheckIns(viewer, rows.map((row) => row.ownerId));
  return rows
    .map((row) => ({ ...row, lastCheckInOn: checkIns.get(row.ownerId) ?? null }))
    .sort(byNeed(sastDate(now)));
}

/**
 * The latest check-in's day for each owner `viewer` may follow (role views spec 6; N4 plan decision 2): a map from the
 * owner's account to YYYY-MM-DD. The day only, never what was said, and nothing about the viewer's own shop or a shop
 * they don't follow, as private.can_mentor decides on Supabase.
 */
export async function lastCheckIns(viewer: Viewer, ownerIds: readonly string[]): Promise<Map<string, string>> {
  if (onSupabase()) return (await supabase()).lastCheckIns(viewer, ownerIds);
  const { sellerProfiles, mentorNotes } = sampleStore();
  const allowed = new Set(ownerIds.filter((id) => mayMentor(viewer, sellerProfiles.get(id))));
  const latest = new Map<string, string>();
  for (const row of mentorNotes.values()) {
    if (row.kind !== "check-in" || row.checkInOn === null || !allowed.has(row.ownerId)) continue;
    const seen = latest.get(row.ownerId);
    if (seen === undefined || row.checkInOn > seen) latest.set(row.ownerId, row.checkInOn);
  }
  return latest;
}

/** One shop's row, when `viewer` may open its mentor page; null otherwise, which the page answers with the 404. */
export async function getMentoredShop(
  slug: string,
  viewer: Pick<Account, "id" | "roles">,
  now: Date,
): Promise<MentoredShop | null> {
  return (await mentoredShops(viewer, now)).find((row) => row.slug === slug) ?? null;
}

/** A note or check-in as the shop's mentor page lists it. */
export type MentorNoteView = Pick<MentorNoteRow, "id" | "kind" | "checkInOn" | "text" | "authorName" | "createdAt">;

/** What's been written about a shop's owner, newest first. */
export async function listNotes(ownerId: string): Promise<MentorNoteView[]> {
  if (onSupabase()) return (await supabase()).listNotes(ownerId);
  return [...sampleStore().mentorNotes.values()]
    .filter((row) => row.ownerId === ownerId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map(({ id, kind, checkInOn, text, authorName, createdAt }) => ({ id, kind, checkInOn, text, authorName, createdAt }));
}

/**
 * A new note or check-in about a shop's owner. Its id. Server Actions only: it makes ids. `onceToken` is the form's
 * one-time token (C4/C5 plan decision 6): on Supabase add_mentor_note and add_check_in take it in the same transaction
 * as the note. The sample ignores it: its action takes the token itself (takeOnceToken).
 */
export async function addNote(
  note: {
    ownerId: string;
    kind: MentorNoteRow["kind"];
    checkInOn: string | null;
    text: string;
    author: { id: string; firstName: string };
    now: Date;
  },
  onceToken?: string,
): Promise<string> {
  if (onSupabase()) return (await supabase()).addNote(note, onceToken);
  const { ownerId, kind, checkInOn, text, author, now } = note;
  const id = `mn-${randomUUID()}`;
  sampleStore().mentorNotes.set(id, {
    id,
    ownerId,
    kind,
    checkInOn: kind === "check-in" ? checkInOn : null,
    text,
    authorId: author.id,
    authorName: author.firstName,
    createdAt: now.toISOString(),
  });
  return id;
}
