import type { BookingStatus } from "@/lib/types";
import { sampleStore } from "./store";

// What deleting an account does to the staff tools' tables, and what the account's data export holds of them (POPIA;
// staff tools plan decisions 6, 11, 13 and 16). lib/data/accounts.ts calls both. This module imports only the store,
// so nothing that imports accounts.ts is imported here, and there's no cycle.

const DELETED = "Deleted account";

/**
 * Forgets an account in the staff tools:
 * - the audit log keeps every entry (plan decision 6): the account's own say "Deleted account", and those about it
 *   lose its name, id and reason;
 * - notes and check-ins about it go; ones it wrote stay, as "Deleted account", and its shops lose it as their mentor;
 * - its RSVPs and slot requests go, and so do the "asked for a slot" notifications that name it (plan amendment 2);
 * - its posts stay for the Hub (plan decision 11), and the answers, pins and closed reports it left stay, unsigned.
 */
export async function forgetAccountInStaffTools(accountId: string): Promise<void> {
  const store = sampleStore();
  for (const row of store.auditLog.values()) {
    if (row.staffId === accountId) Object.assign(row, { staffId: null, staffName: DELETED });
    if (row.subjectId === accountId) {
      Object.assign(row, { subjectId: null, targetId: "", targetName: DELETED, detail: "" });
    }
  }
  for (const [id, row] of store.mentorNotes) {
    if (row.ownerId === accountId) store.mentorNotes.delete(id);
    else if (row.authorId === accountId) Object.assign(row, { authorId: null, authorName: DELETED });
  }
  for (const profile of store.sellerProfiles.values()) {
    if (profile.mentorId === accountId) profile.mentorId = null;
  }
  for (const [key, row] of store.hubRsvps) {
    if (row.accountId === accountId) store.hubRsvps.delete(key);
  }
  const goneBookings = new Set<string>();
  for (const [id, row] of store.hubBookings) {
    if (row.accountId === accountId) {
      goneBookings.add(id);
      store.hubBookings.delete(id);
    } else if (row.answeredBy === accountId) row.answeredBy = null;
  }
  for (const [id, row] of store.notifications) {
    if (row.kind === "booking" && goneBookings.has(row.subjectId)) store.notifications.delete(id);
  }
  for (const row of store.hubPosts.values()) {
    if (row.authorId === accountId) row.authorId = null;
  }
  for (const row of store.featuredPins.values()) {
    if (row.pinnedBy === accountId) row.pinnedBy = null;
  }
  for (const row of store.reports.values()) {
    if (row.closedBy === accountId) row.closedBy = null;
  }
}

/** The staff tools' part of the data export: no ids, and no mentor's notes (spec 2.6, plan decision 16). */
export type StaffToolsExport = {
  /** Events the account said it's going to. */
  hubRsvps: { event: string; at: string }[];
  slotRequests: { officeHours: string; help: string; time: string; status: BookingStatus; at: string }[];
};

export async function exportStaffToolsData(accountId: string): Promise<StaffToolsExport> {
  const { hubRsvps, hubBookings, hubPosts } = sampleStore();
  const title = (postId: string) => hubPosts.get(postId)?.title ?? "A removed post";
  return {
    hubRsvps: [...hubRsvps.values()]
      .filter((row) => row.accountId === accountId)
      .map((row) => ({ event: title(row.postId), at: row.createdAt })),
    slotRequests: [...hubBookings.values()]
      .filter((row) => row.accountId === accountId)
      .map((row) => ({ officeHours: title(row.postId), help: row.help, time: row.time, status: row.status, at: row.createdAt })),
  };
}
