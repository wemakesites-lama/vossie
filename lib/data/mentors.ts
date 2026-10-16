import { randomUUID } from "node:crypto";
import { FORMER_STAFF } from "@/lib/staff/audit-words";
import { MENTOR_WINDOW_DAYS, mentorFlags } from "@/lib/staff/mentor";
import { isAdmin } from "@/lib/staff/roles";
import type { Account, MentoredShop } from "@/lib/types";
import type { MentorNoteRow } from "./rows";
import { recentCounts } from "./shop-stats";
import { sampleStore } from "./store";

// The mentor dashboard's data (staff tools spec 2.6; plan decisions 15 and 16, amendment 16). A mentor sees the shops
// assigned to them; an admin sees every assigned shop. Each has its last 14 days' numbers and its flags: numbers,
// never messages (FUNCTION-MAP K1). Notes and check-ins are about the shop's owner (keyed by their account, so a
// changed link doesn't lose them), seen only by the shop's mentor and the admins, and in the owner's data download;
// the author or an admin can delete one. Times come from the caller; only Server Actions write.

type Viewer = Pick<Account, "id" | "roles">;

/** The shops `viewer` may follow (plan decision 15): theirs, or for an admin every assigned shop. By name. */
export async function mentoredShops(viewer: Viewer, now: Date): Promise<MentoredShop[]> {
  const { sellerProfiles, sellers, accounts } = sampleStore();
  const rows: MentoredShop[] = [];
  for (const profile of sellerProfiles.values()) {
    const mentorId = profile.mentorId ?? null;
    if (!mentorId || profile.status === "pending" || !profile.sellerSlug) continue;
    if (!isAdmin(viewer) && mentorId !== viewer.id) continue;
    const shop = sellers.get(profile.sellerSlug);
    const owner = accounts.get(profile.accountId);
    if (!shop || !owner) continue;
    const counts = await recentCounts(shop.slug, MENTOR_WINDOW_DAYS, now);
    rows.push({
      slug: shop.slug,
      name: shop.name,
      campusSlug: shop.campusSlug,
      ownerName: owner.firstName,
      ownerId: owner.id,
      badge: shop.badge,
      status: profile.status,
      mentorId,
      // Deleting a mentor's account takes them off their shops (lib/data/staff-privacy.ts), so this is a fallback.
      mentorName: accounts.get(mentorId)?.firstName ?? FORMER_STAFF,
      counts,
      flags: mentorFlags(counts, profile.status),
    });
  }
  return rows.sort((a, b) => a.name.localeCompare(b.name));
}

/** One shop's row, when `viewer` may open its mentor page; null otherwise, which the page answers with the 404. */
export async function getMentoredShop(slug: string, viewer: Viewer, now: Date): Promise<MentoredShop | null> {
  return (await mentoredShops(viewer, now)).find((row) => row.slug === slug) ?? null;
}

/** A note or check-in as the shop's mentor page lists it. `authorId` decides who may delete it (canDeleteNote). */
export type MentorNoteView = Pick<
  MentorNoteRow,
  "id" | "kind" | "checkInOn" | "text" | "authorId" | "authorName" | "createdAt"
>;

/** What's been written about a shop's owner, newest first. */
export async function listNotes(ownerId: string): Promise<MentorNoteView[]> {
  return [...sampleStore().mentorNotes.values()]
    .filter((row) => row.ownerId === ownerId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map(({ id, kind, checkInOn, text, authorId, authorName, createdAt }) => ({
      id,
      kind,
      checkInOn,
      text,
      authorId,
      authorName,
      createdAt,
    }));
}

/** A new note or check-in about a shop's owner. Its id. Server Actions only: it makes ids. */
export async function addNote({
  ownerId,
  kind,
  checkInOn,
  text,
  author,
  now,
}: {
  ownerId: string;
  kind: MentorNoteRow["kind"];
  checkInOn: string | null;
  text: string;
  author: { id: string; firstName: string };
  now: Date;
}): Promise<string> {
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

/**
 * Whether `viewer` may delete this note or check-in (amendment 16, POPIA section 24): its author, or an admin. Once
 * the author's account has gone, only an admin.
 */
export function canDeleteNote(viewer: Viewer, note: Pick<MentorNoteRow, "authorId">): boolean {
  return isAdmin(viewer) || (note.authorId !== null && note.authorId === viewer.id);
}

/**
 * Deletes a note or check-in for its author or an admin (amendment 16). What it was, for the action's audit entry
 * ("note-deleted" or "check-in-deleted", which keeps no text); null when there's nothing `viewer` may delete (a
 * second press, an unknown id, or someone else's note). Checked and deleted with no await between (amendment 19).
 */
export async function deleteNote(
  id: string,
  viewer: Viewer,
): Promise<Pick<MentorNoteRow, "id" | "ownerId" | "kind"> | null> {
  const { mentorNotes } = sampleStore();
  const row = mentorNotes.get(id);
  if (!row || !canDeleteNote(viewer, row)) return null;
  mentorNotes.delete(id);
  return { id: row.id, ownerId: row.ownerId, kind: row.kind };
}
