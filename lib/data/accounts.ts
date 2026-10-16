import { randomUUID } from "node:crypto";
import { sampleAccounts, sampleConsents } from "@/data/fixtures/accounts";
import type { Account, Consent, SellerStatus, StaffRole, ViewerActivity } from "@/lib/types";
import type { AccountRow } from "./rows";
import { listSessions } from "./sessions";
import { exportConversations, forgetAccountInMessaging, unreadCounts, type ConversationExport } from "./messages";
import { exportNotifications, type NotificationExport } from "./notifications";
import { deleteReportsBy, exportReports, type ReportExport } from "./reports";
import { exportShop, forgetShopOf, type ListingExport, type ShopExport } from "./shops";
import { exportStaffToolsData, forgetAccountInStaffTools, type StaffToolsExport } from "./staff-privacy";
import { sampleStore } from "./store";

// Accounts, their shops and their consent (accounts spec section 4), shaped like the Supabase calls that will replace
// them: async, by id or by email, handing out copies. Times come from the caller, so nothing here reads the clock.
// Only Server Actions create, change or delete; pages only read.

function toAccount(row: AccountRow): Account {
  const shop = sampleStore().sellerProfiles.get(row.id);
  return {
    id: row.id,
    email: row.email,
    firstName: row.firstName,
    campusSlug: row.campusSlug,
    roles: [...row.roles],
    seller: shop ? { status: shop.status, sellerSlug: shop.sellerSlug } : null,
    createdAt: row.createdAt,
  };
}

export async function getAccount(id: string): Promise<Account | null> {
  const row = sampleStore().accounts.get(id);
  return row ? toAccount(row) : null;
}

function rowByEmail(email: string): AccountRow | null {
  for (const row of sampleStore().accounts.values()) {
    if (row.email === email) return row;
  }
  return null;
}

/** The account with this (normalised) email, if there is one. */
export async function findAccountByEmail(email: string): Promise<Account | null> {
  const row = rowByEmail(email);
  return row ? toAccount(row) : null;
}

/**
 * A new student account (spec 2.6). Its id is random, as Supabase's would be. An email has one account, ever: when
 * there is one already, whatever made this call (a second tab, a double post), that account is returned, unchanged,
 * and its first name and campus are not overwritten with the new ones.
 *
 * Looking and making are one step here, because nothing awaits between them. The real backend must do the same with a
 * unique index on the email (`INSERT … ON CONFLICT (email) DO NOTHING`, then read the row that is there).
 */
export async function createAccount(details: {
  email: string;
  firstName: string;
  campusSlug: string;
  now: Date;
}): Promise<Account> {
  const existing = rowByEmail(details.email);
  if (existing) return toAccount(existing);
  const row: AccountRow = {
    id: `acc-${randomUUID()}`,
    email: details.email,
    firstName: details.firstName,
    campusSlug: details.campusSlug,
    roles: [],
    createdAt: details.now.toISOString(),
  };
  sampleStore().accounts.set(row.id, row);
  return toAccount(row);
}

/** "Edit details" (spec 3.2). Null when the account has gone. */
export async function updateAccountDetails(
  id: string,
  details: { firstName: string; campusSlug: string },
): Promise<Account | null> {
  const row = sampleStore().accounts.get(id);
  if (!row) return null;
  row.firstName = details.firstName;
  row.campusSlug = details.campusSlug;
  return toAccount(row);
}

/** Records that the account agreed to `version` at `at` (spec 2.7). Once per version: a repeat changes nothing. */
export async function recordConsent(accountId: string, version: string, at: Date): Promise<void> {
  const { consents } = sampleStore();
  for (const row of consents.values()) {
    if (row.accountId === accountId && row.version === version) return;
  }
  const id = `consent-${randomUUID()}`;
  consents.set(id, { id, accountId, version, agreedAt: at.toISOString() });
}

/** The newest consent, for the privacy settings page (spec 3.3). */
export async function getLatestConsent(accountId: string): Promise<Consent | null> {
  let latest: Consent | null = null;
  for (const row of sampleStore().consents.values()) {
    if (row.accountId !== accountId) continue;
    if (!latest || Date.parse(row.agreedAt) > Date.parse(latest.agreedAt)) {
      latest = { version: row.version, agreedAt: row.agreedAt };
    }
  }
  return latest;
}

/**
 * The numbers for the context strip (spec 2.9 and 3.4), or null when the account has gone: its unread messages and
 * the sales it has to confirm, from stage E's store (messaging spec 3.6). Saves stay on the device (spec 2.12), so
 * none "come back" through the account. `now` settles the 7-day auto-confirm (messaging spec 2.5).
 */
export async function getAccountActivity(accountId: string, now: Date): Promise<ViewerActivity | null> {
  if (!sampleStore().accounts.has(accountId)) return null;
  const counts = await unreadCounts(accountId, now);
  return { newMessages: counts.messages, salesToConfirm: counts.salesToConfirm, savedItemsBack: 0 };
}

/** The sample accounts' buttons on the sign-in page (spec 2.8), in the fixture's order. */
export async function getSampleSignIns(): Promise<{ email: string; label: string }[]> {
  return sampleAccounts.map(({ account, label }) => ({ email: account.email, label }));
}

/**
 * Puts a deleted sample account back from the fixtures, with its shop and consent (plan decision 15). An account that
 * already has the address, the sample itself or one made after it was deleted, is returned as it is. Null for an
 * address that isn't a sample account's.
 */
export async function restoreSampleAccount(email: string): Promise<Account | null> {
  const sample = sampleAccounts.find(({ account }) => account.email === email);
  if (!sample) return null;
  const existing = await findAccountByEmail(email);
  if (existing) return existing;
  const { account, seller } = structuredClone(sample);
  const store = sampleStore();
  store.accounts.set(account.id, account);
  if (seller) store.sellerProfiles.set(seller.accountId, seller);
  for (const consent of sampleConsents) {
    if (consent.accountId === account.id) store.consents.set(consent.id, { ...consent });
  }
  return toAccount(account);
}

/**
 * "Download your data" (spec 3.3, plan decision 20). Messaging adds conversations, reports and notifications
 * (messaging plan decision 15); selling adds the shop and its listings (selling plan decision 22); the staff tools add
 * the Hub's RSVPs and slot requests and the mentors' notes about the account (staff tools plan decision 16, amendment
 * 16), and where the shop stands with the Hub (amendment 25).
 */
export type AccountExport = {
  exportedAt: string;
  account: {
    email: string;
    firstName: string;
    campus: string;
    roles: StaffRole[];
    memberSince: string;
    shop: { status: SellerStatus; storefront: string | null } | null;
  };
  consents: { policy: string; agreedAt: string }[];
  /** When each session started and ends. Never an id. */
  sessions: { signedInAt: string; expiresAt: string }[];
  /** Every conversation, with both sides' messages marked "you" or "them". */
  conversations: ConversationExport[];
  reports: ReportExport[];
  notifications: NotificationExport[];
  /** The account's shop, if it has one, and every listing in it, drafts included. */
  shop: ShopExport | null;
  listings: ListingExport[];
  /** The Hub's events the account said it's going to, and its office-hours slot requests (staff tools plan decision 16). */
  hubRsvps: StaffToolsExport["hubRsvps"];
  slotRequests: StaffToolsExport["slotRequests"];
  /** The mentors' notes and check-ins about the account, which are its to read (staff tools plan amendment 16). */
  mentorNotes: StaffToolsExport["mentorNotes"];
};

/** The account's data, as the export gives it. Null when the account has gone. */
export async function exportAccountData(accountId: string, now: Date): Promise<AccountExport | null> {
  const account = await getAccount(accountId);
  if (!account) return null;
  const consents = [...sampleStore().consents.values()]
    .filter((row) => row.accountId === accountId)
    .sort((a, b) => Date.parse(a.agreedAt) - Date.parse(b.agreedAt))
    .map((row) => ({ policy: row.version, agreedAt: row.agreedAt }));
  const sessions = (await listSessions(accountId)).map((row) => ({ signedInAt: row.createdAt, expiresAt: row.expiresAt }));
  // Conversations first: exporting them settles any sale that has confirmed itself (messaging plan amendment 3), which
  // reads that sale's notification, and the notifications must be read after that.
  const conversations = await exportConversations(accountId, now);
  const [reports, notifications] = await Promise.all([exportReports(accountId), exportNotifications(accountId)]);
  const selling = await exportShop(accountId);
  const hub = await exportStaffToolsData(accountId);
  return {
    exportedAt: now.toISOString(),
    account: {
      email: account.email,
      firstName: account.firstName,
      campus: account.campusSlug,
      roles: [...account.roles],
      memberSince: account.createdAt,
      shop: account.seller ? { status: account.seller.status, storefront: account.seller.sellerSlug } : null,
    },
    consents,
    sessions,
    conversations,
    reports,
    notifications,
    shop: selling.shop,
    listings: selling.listings,
    hubRsvps: hub.hubRsvps,
    slotRequests: hub.slotRequests,
    mentorNotes: hub.mentorNotes,
  };
}

/**
 * Deletes an account straight away (spec 2.13): the account, its shop, its consent, its sessions and their forms'
 * state, any sign-in under way for its email, every sample outbox row addressed to its email (found by address, so
 * a row whose attempt has already ended goes too), and its code count. Messaging's tables go first (messaging plan
 * decision 14), then selling's shop, listings, photos and wizard draft (selling plan decision 22), then the staff
 * tools' (staff tools plan, Task 8): notes about it, its RSVPs and slot requests go, and the audit log forgets it.
 * Nothing of anyone else's is touched.
 */
export async function deleteAccountData(accountId: string): Promise<void> {
  const store = sampleStore();
  const account = store.accounts.get(accountId);
  if (!account) return;
  // Messaging first, while the account's storefront is still known: its messages, reports and notifications go, and
  // the other side keeps its own side of each conversation (messaging plan decision 14).
  await forgetAccountInMessaging(accountId, store.sellerProfiles.get(accountId)?.sellerSlug ?? null);
  await deleteReportsBy(accountId);
  // Then its shop, the shop's listings, every photo it uploaded and its wizard draft (selling plan decision 22).
  await forgetShopOf(accountId);
  // Then the staff tools, while its seller profile still names its shop's link (staff tools plan amendment 11): notes
  // about it, its RSVPs and slot requests go; the audit log forgets it (staff tools plan, Task 8).
  await forgetAccountInStaffTools(accountId);
  store.accounts.delete(accountId);
  store.sellerProfiles.delete(accountId);
  for (const [id, row] of store.consents) {
    if (row.accountId === accountId) store.consents.delete(id);
  }
  const sessionKeys = new Set<string>();
  for (const [key, row] of store.sessions) {
    if (row.accountId !== accountId) continue;
    sessionKeys.add(key);
    store.sessions.delete(key);
  }
  for (const [key, row] of store.formStates) {
    if (sessionKeys.has(row.sessionKey)) store.formStates.delete(key);
  }
  for (const [key, row] of store.signInAttempts) {
    if (row.email !== account.email) continue;
    store.signInAttempts.delete(key);
    store.sampleEmails.delete(key);
  }
  for (const [key, row] of store.sampleEmails) {
    if (row.to === account.email) store.sampleEmails.delete(key);
  }
  store.codeSends.delete(account.email);
}
