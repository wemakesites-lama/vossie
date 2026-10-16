import { FORMER_STAFF } from "@/lib/staff/audit-words";
import type { BookingStatus } from "@/lib/types";
import type { MentorNoteRow } from "./rows";
import { sampleStore } from "./store";

// What deleting an account does to the staff tools' tables, and what the account's data export holds of them (POPIA;
// staff tools plan decisions 6, 11, 13 and 16; amendments 11, 16, 17, 21, 31 and 41). lib/data/accounts.ts calls
// both. This module imports only the store and plain words, so nothing that imports accounts.ts is imported here, and
// there's no cycle.

/** Who the audit log names in place of someone whose account has gone, when the entry was about them. */
const DELETED = "Deleted account";

/**
 * Forgets an account in the staff tools. Call it while the account's seller profile is still there (it reads the
 * shop's link from it, amendment 11):
 * - the audit log keeps every entry (plan decision 6). The ones the account made as staff keep its id and say "Former
 *   staff member" (amendments 17 and 31); the ones about it (amendment 21) lose its name, id and reason;
 * - notes and check-ins about it go; the ones it wrote stay, as "Former staff member", and its shops lose it as their
 *   mentor;
 * - its RSVPs and slot requests go, with the notifications that told the office hours' author about each request;
 * - its shop's Featured pins go, and the shop leaves the rows recorded for each day;
 * - its posts stay for the Hub (plan decision 11), and the answers, pins and closed reports it left stay, unsigned.
 *   The Hub's covers belong to the Hub, not to the account, so they stay too (amendment 41); its photos still waiting
 *   for a post go with every other photo it uploaded (lib/data/shops.ts, forgetShopOf).
 */
export async function forgetAccountInStaffTools(accountId: string): Promise<void> {
  const store = sampleStore();

  for (const row of store.auditLog.values()) {
    if (row.staffId === accountId) row.staffName = FORMER_STAFF;
    if (row.subjectId === accountId) {
      Object.assign(row, { subjectId: null, targetId: "", targetName: DELETED, detail: "" });
    }
  }

  for (const [id, row] of store.mentorNotes) {
    if (row.ownerId === accountId) store.mentorNotes.delete(id);
    else if (row.authorId === accountId) Object.assign(row, { authorId: null, authorName: FORMER_STAFF });
  }
  for (const profile of store.sellerProfiles.values()) {
    if (profile.mentorId === accountId) profile.mentorId = null;
  }

  for (const [key, row] of store.hubRsvps) {
    if (row.accountId === accountId) store.hubRsvps.delete(key);
  }
  const requests = new Set<string>();
  for (const [id, row] of store.hubBookings) {
    if (row.accountId === accountId) {
      requests.add(id);
      store.hubBookings.delete(id);
    } else if (row.answeredBy === accountId) {
      row.answeredBy = null;
    }
  }
  for (const [id, row] of store.notifications) {
    if (row.kind === "booking" && requests.has(row.subjectId)) store.notifications.delete(id);
  }
  for (const row of store.hubPosts.values()) {
    if (row.authorId === accountId) row.authorId = null;
  }

  // The shop's link, from the profile and from any shop row still there.
  const shops = new Set<string>();
  const ownLink = store.sellerProfiles.get(accountId)?.sellerSlug;
  if (ownLink) shops.add(ownLink);
  for (const row of store.sellers.values()) {
    if (row.ownerId === accountId) shops.add(row.slug);
  }
  for (const [id, row] of store.featuredPins) {
    if (shops.has(row.sellerSlug)) store.featuredPins.delete(id);
    else if (row.pinnedBy === accountId) row.pinnedBy = null;
  }
  for (const row of store.featuredDraws.values()) {
    if (row.sellerSlugs.some((slug) => shops.has(slug))) {
      row.sellerSlugs = row.sellerSlugs.filter((slug) => !shops.has(slug));
    }
  }

  for (const row of store.reports.values()) {
    if (row.closedBy === accountId) row.closedBy = null;
  }
}

/**
 * The staff tools' part of the data export, with no ids (plan decision 16): the events the account said it's going
 * to, its office-hours slot requests, and the mentors' notes and check-ins about it, which are the seller's to read
 * (amendment 16, POPIA section 23).
 */
export type StaffToolsExport = {
  hubRsvps: { event: string; at: string }[];
  slotRequests: { officeHours: string; help: string; time: string; status: BookingStatus; at: string }[];
  /** Newest first, as the mentor's page lists them. `by` is the author's first name, or "Former staff member". */
  mentorNotes: { kind: MentorNoteRow["kind"]; checkInOn: string | null; text: string; by: string; at: string }[];
};

export async function exportStaffToolsData(accountId: string): Promise<StaffToolsExport> {
  const { hubRsvps, hubBookings, hubPosts, mentorNotes } = sampleStore();
  const title = (postId: string) => hubPosts.get(postId)?.title ?? "A removed post";
  return {
    hubRsvps: [...hubRsvps.values()]
      .filter((row) => row.accountId === accountId)
      .map((row) => ({ event: title(row.postId), at: row.createdAt })),
    slotRequests: [...hubBookings.values()]
      .filter((row) => row.accountId === accountId)
      .map((row) => ({
        officeHours: title(row.postId),
        help: row.help,
        time: row.time,
        status: row.status,
        at: row.createdAt,
      })),
    mentorNotes: [...mentorNotes.values()]
      .filter((row) => row.ownerId === accountId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((row) => ({
        kind: row.kind,
        checkInOn: row.checkInOn,
        text: row.text,
        by: row.authorName,
        at: row.createdAt,
      })),
  };
}
