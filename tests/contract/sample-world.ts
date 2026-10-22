import { randomUUID } from "node:crypto";
import { deleteAccountData, getAccount } from "@/lib/data/accounts";
import { notifyFollowers } from "@/lib/data/follows";
import { startOffer } from "@/lib/data/messages";
import { saveOwnListing } from "@/lib/data/own-listings";
import { photoIdOf } from "@/lib/data/photos";
import type { AccountRow, ConversationRow, SellerRow } from "@/lib/data/rows";
import { saleNoteText } from "@/lib/messaging/notification-text";
import { threadPath } from "@/lib/messaging/paths";
import { resetSampleStore, sampleStore } from "@/lib/data/store";
import { SLUG_MAX, slugify } from "@/lib/selling/rules";
import { sastDate } from "@/lib/time";
import type { NotificationKind } from "@/lib/types";
import { ALL_CAMPUSES } from "@/lib/campus";
import { listingFields, type World, type WorldAccountName } from "./world";

// The sample store's world (2b plan Task 13): a fresh store for each test (resetSampleStore, as the unit tests do), and
// verbs that write it as the unit tests do. It never reaches Supabase (lib/data/boundaries.test.ts).

/** The sample account for a world account: the same email as on Supabase, a profile on Pretoria, "staff" an Admin. */
function accountRow(name: WorldAccountName): AccountRow {
  return {
    id: `acc-contract-${name}`,
    email: `contract-${name}@vossie.test`,
    firstName: name[0].toUpperCase() + name.slice(1),
    campusSlug: "pretoria",
    roles: name === "staff" ? ["admin"] : [],
    createdAt: "2026-10-01T08:00:00.000Z",
  };
}

/** A link no shop has or had, from the name, as createShop makes one ("…-2" and so on). */
function freeSlug(name: string): string {
  const { sellers } = sampleStore();
  const taken = (slug: string) => sellers.has(slug) || [...sellers.values()].some((row) => row.previousSlugs.includes(slug));
  for (let n = 1; ; n += 1) {
    const suffix = n === 1 ? "" : `-${n}`;
    const slug = `${slugify(name).slice(0, SLUG_MAX - suffix.length).replace(/-+$/, "")}${suffix}`;
    if (!taken(slug)) return slug;
  }
}

/** A shop row for the store, as openShop makes one: no owner when `ownerId` is null (a sample shop). */
function shopRow(slug: string, name: string, ownerId: string | null, campus: string, at: string, pointIds: string[]): SellerRow {
  return {
    slug,
    ownerId,
    name,
    tagline: "A shop the contract tests open.",
    categorySlug: "tech",
    campusSlug: campus,
    verified: false,
    badge: "new-seller",
    about: "A shop the contract tests open and close again.",
    since: at.slice(0, 7),
    image: null,
    pickupPointIds: pointIds,
    slugChanged: false,
    previousSlugs: [],
    createdAt: at,
    updatedAt: at,
  };
}

/** The sample session key a world account's forms are kept under. */
const sessionKeyOf = (name: WorldAccountName) => `session-contract-${name}`;

/** A sample world. Made before each test: it starts from a fresh store. */
export function sampleWorld(): World {
  resetSampleStore();
  return {
    name: "sample",
    async signedIn(name) {
      const accounts = sampleStore().accounts;
      const row = accountRow(name);
      if (!accounts.has(row.id)) accounts.set(row.id, row);
      return row.id;
    },
    async asViewer(name, read) {
      return read(await this.signedIn(name));
    },
    async hideListing(id, reason) {
      const row = sampleStore().listings.get(id);
      if (!row) throw new Error(`No listing ${id}`);
      row.hiddenAt = "2026-10-01T08:00:00.000Z";
      row.hiddenReason = reason;
    },
    async pauseShop(slug, by) {
      const store = sampleStore();
      const ownerId = store.sellers.get(slug)?.ownerId;
      const profile = ownerId ? store.sellerProfiles.get(ownerId) : undefined;
      if (!profile) throw new Error(`No owned shop ${slug}`);
      profile.status = "paused";
      profile.pausedBy = by;
    },
    async draftListing(id) {
      const row = sampleStore().listings.get(id);
      if (!row) throw new Error(`No listing ${id}`);
      row.state = "draft";
    },
    async addRsvp(postId, name) {
      const accountId = await this.signedIn(name);
      const key = `${postId}:${accountId}`;
      sampleStore().hubRsvps.set(key, { key, postId, accountId, createdAt: "2026-10-01T08:00:00.000Z" });
    },
    async unpublishPost(id) {
      const row = sampleStore().hubPosts.get(id);
      if (!row) throw new Error(`No Hub post ${id}`);
      row.published = false;
    },
    async addRequest({ asker, title, neededBy }) {
      const askerId = await this.signedIn(asker);
      const requests = sampleStore().requests;
      const id = `contract-${requests.size + 1}`;
      const now = new Date().toISOString();
      requests.set(id, {
        id,
        askerId,
        title,
        categorySlug: "tech",
        campusSlug: "pretoria",
        details: "A request the contract tests post and the world takes away again.",
        budgetZar: null,
        swapWelcome: false,
        neededBy,
        status: "open",
        createdAt: now,
        updatedAt: now,
        closedAt: null,
        closedBy: null,
        remindedFor: null,
        seedOffers: 0,
        hiddenAt: null,
        hiddenReason: null,
      });
      return id;
    },
    async notificationsOf(name) {
      const accountId = await this.signedIn(name);
      return [...sampleStore().notifications.values()]
        .filter((row) => row.accountId === accountId)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
        .map(({ kind, subjectId, text, href }) => ({ kind, subjectId, text, href }));
    },
    async retirePickupPoint(id) {
      const row = sampleStore().pickupPoints.get(id);
      if (!row) throw new Error(`No pickup point ${id}`);
      row.retiredAt = "2026-10-01T08:00:00.000Z";
    },
    async recordDraw(campus, day, slugs) {
      const key = `${campus}:${day}`;
      sampleStore().featuredDraws.set(key, { key, campusSlug: campus, day, sellerSlugs: [...slugs] });
    },
    async addPin(campus, day, slug) {
      const pins = sampleStore().featuredPins;
      const id = `pin-contract-${pins.size + 1}`;
      // A second apart, so they keep the order they were made in.
      const createdAt = new Date(Date.UTC(2026, 9, 1, 8, 0, pins.size)).toISOString();
      pins.set(id, { id, sellerSlug: slug, campusSlug: campus, day, pinnedBy: await this.signedIn("staff"), createdAt });
    },
    async unverifyShop(slug) {
      const row = sampleStore().sellers.get(slug);
      if (!row) throw new Error(`No shop ${slug}`);
      row.verified = false;
    },
    async forgetFeaturedDays() {
      // Nothing to forget: the next test's world starts from a fresh store.
    },
    async keepBadges() {
      // Nothing to keep: the next test's world starts from a fresh store.
    },
    async tidySelling() {
      // Nothing to tidy: the next test's world starts from a fresh store.
    },
    async ageWaitingPhoto(src, hours) {
      const row = sampleStore().photos.get(photoIdOf(src) ?? "");
      if (!row) throw new Error(`No photo ${src}`);
      row.createdAt = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
    },
    async openShop(name, { name: shopName, campus = "pretoria", status = "approved", pausedBy } = {}) {
      const ownerId = await this.signedIn(name);
      const store = sampleStore();
      if (store.sellerProfiles.has(ownerId)) throw new Error(`${name} has a shop already`);
      const title = shopName ?? `Contract ${name[0].toUpperCase()}${name.slice(1)}'s shop`;
      const slug = freeSlug(title);
      const now = new Date();
      const at = now.toISOString();
      const point = [...store.pickupPoints.values()].find((row) => row.campusSlug === campus && !row.retiredAt);
      store.sellers.set(slug, {
        ...shopRow(slug, title, ownerId, campus, at, status === "pending" || !point ? [] : [point.id]),
        since: sastDate(now).slice(0, 7),
      });
      store.sellerProfiles.set(ownerId, {
        accountId: ownerId,
        status,
        sellerSlug: status === "pending" ? null : slug,
        appliedAt: at,
        pausedBy: status === "paused" ? (pausedBy ?? "seller") : null,
        approvedAt: status === "pending" ? null : at,
      });
      return slug;
    },
    async follow(follower, slug, at = new Date()) {
      const accountId = await this.signedIn(follower);
      const follows = sampleStore().follows;
      const id = `follow-contract-${follows.size + 1}`;
      follows.set(id, { id, accountId, sellerSlug: slug, createdAt: at.toISOString() });
    },
    async addNotification(name, note, at = new Date()) {
      const accountId = await this.signedIn(name);
      const notifications = sampleStore().notifications;
      const id = `note-contract-${notifications.size + 1}`;
      notifications.set(id, {
        id,
        accountId,
        kind: note.kind as NotificationKind,
        subjectId: note.subjectId,
        text: note.text,
        href: note.href,
        createdAt: at.toISOString(),
        readAt: null,
      });
    },
    async tidyMessaging() {
      // Nothing to tidy: the next test's world starts from a fresh store.
    },
    async addConversation({ buyer, slug, listingId, listingTitle, offerOn, status, messages }) {
      const store = sampleStore();
      const buyerId = await this.signedIn(buyer);
      if (!store.sellers.has(slug)) throw new Error(`No shop ${slug}`);
      const title = listingId ? store.listings.get(listingId)?.title : listingTitle;
      if (listingId && !title) throw new Error(`No listing ${listingId}`);
      const request = offerOn ? store.requests.get(offerOn) : undefined;
      if (offerOn && !request) throw new Error(`No request ${offerOn}`);
      const first = messages[0]?.sentAt ?? new Date();
      const last = messages.at(-1)?.sentAt ?? first;
      const sellerFirst = messages.find((message) => message.side === "seller");
      const row: ConversationRow = {
        id: `conv-${randomUUID()}`,
        listingId: listingId ?? null,
        listingTitle: title ?? null,
        sellerSlug: slug,
        buyerId,
        sellerGone: false,
        status: status ?? (offerOn ? "offered" : sellerFirst ? "replied" : "asked"),
        createdAt: first.toISOString(),
        lastMessageAt: last.toISOString(),
        firstReplyAt: !offerOn && sellerFirst ? sellerFirst.sentAt.toISOString() : null,
        completedAt: null,
        confirmedAt: null,
        confirmedBy: null,
        ...(request ? { requestId: request.id, requestTitle: request.title } : {}),
      };
      store.conversations.set(row.id, row);
      for (const message of messages) {
        const id = `msg-${randomUUID()}`;
        store.messages.set(id, {
          id,
          conversationId: row.id,
          from: message.side,
          body: message.body,
          swapOffer: null,
          sentAt: message.sentAt.toISOString(),
          readAt: message.readAt ? message.readAt.toISOString() : null,
        });
      }
      return row.id;
    },
    async addMessages(conversationId, side, count, sentAt) {
      const store = sampleStore();
      const row = store.conversations.get(conversationId);
      if (!row) throw new Error(`No conversation ${conversationId}`);
      for (let n = 0; n < count; n += 1) {
        const id = `msg-${randomUUID()}`;
        store.messages.set(id, {
          id,
          conversationId,
          from: side,
          body: `Message ${n + 1}`,
          swapOffer: null,
          sentAt: sentAt.toISOString(),
          readAt: null,
        });
      }
      if (sentAt.toISOString() > row.lastMessageAt) row.lastMessageAt = sentAt.toISOString();
    },
    async markDone(conversationId, completedAt) {
      const store = sampleStore();
      const row = store.conversations.get(conversationId);
      if (!row || !row.buyerId) throw new Error(`No conversation with a buyer ${conversationId}`);
      row.status = "done";
      row.completedAt = completedAt.toISOString();
      const id = `note-contract-${store.notifications.size + 1}`;
      store.notifications.set(id, {
        id,
        accountId: row.buyerId,
        kind: "sale-to-confirm",
        subjectId: row.id,
        text: saleNoteText({ shop: store.sellers.get(row.sellerSlug)?.name ?? "A closed shop", listingTitle: row.requestTitle ?? row.listingTitle }),
        href: threadPath(row.id),
        createdAt: completedAt.toISOString(),
        readAt: null,
      });
    },
    async sellerGone(conversationId) {
      const row = sampleStore().conversations.get(conversationId);
      if (!row) throw new Error(`No conversation ${conversationId}`);
      row.sellerGone = true;
    },
    async shopGone(conversationId) {
      const store = sampleStore();
      const row = store.conversations.get(conversationId);
      if (!row) throw new Error(`No conversation ${conversationId}`);
      row.sellerGone = true;
      // As forgetShopOf leaves it: the shop's row is gone, and the conversation keeps only its old link.
      store.sellers.delete(row.sellerSlug);
    },
    async buyerGone(conversationId) {
      const row = sampleStore().conversations.get(conversationId);
      if (!row) throw new Error(`No conversation ${conversationId}`);
      row.buyerId = null;
    },
    async hideRequest(id, reason) {
      const row = sampleStore().requests.get(id);
      if (!row) throw new Error(`No request ${id}`);
      row.hiddenAt = new Date().toISOString();
      row.hiddenReason = reason;
    },
    async onceRow(name, form, { taken = false, expiresInMinutes = 60 } = {}) {
      await this.signedIn(name);
      const sessionKey = sessionKeyOf(name);
      const key = `${sessionKey}:${form}`;
      sampleStore().formStates.set(key, {
        key,
        sessionKey,
        form,
        errors: [],
        values: {},
        notice: null,
        expiresAt: new Date(Date.now() + expiresInMinutes * 60 * 1000).toISOString(),
        ...(taken ? { taken: true as const } : {}),
      });
      return sessionKey;
    },
    async setRoles(name, roles) {
      const id = await this.signedIn(name);
      sampleStore().accounts.get(id)!.roles = [...roles];
    },
    async viewerAccount(name) {
      const account = await getAccount(await this.signedIn(name));
      if (!account) throw new Error(`No account ${name}`);
      return account;
    },
    async addListing(slug, listing) {
      const store = sampleStore();
      const shop = store.sellers.get(slug);
      if (!shop) throw new Error(`No shop ${slug}`);
      const id = `l-contract-${store.listings.size + 1}`;
      const at = new Date().toISOString();
      store.listings.set(id, {
        id,
        sellerSlug: slug,
        state: "available",
        ...listingFields(listing, shop.categorySlug),
        campusSlug: shop.campusSlug,
        photos: [],
        createdAt: at,
        firstPublishedAt: at,
        updatedAt: at,
      });
      return id;
    },
    async publishListing(owner, slug, listing) {
      const ownerId = await this.signedIn(owner);
      const store = sampleStore();
      const shop = store.sellers.get(slug);
      if (!shop || shop.ownerId !== ownerId) throw new Error(`${owner} doesn't own ${slug}`);
      const now = new Date();
      const saved = await saveOwnListing({
        sellerSlug: slug,
        ownerId,
        id: null,
        fields: listingFields(listing, shop.categorySlug),
        photos: [],
        intent: "publish",
        now,
      });
      if (!saved) throw new Error(`Couldn't publish in ${slug}`);
      // As saveListingForm does: a first publish by an approved shop of a listing the Hub hasn't hidden.
      if (saved.state === "available" && store.sellerProfiles.get(ownerId)?.status === "approved") {
        await notifyFollowers({ sellerSlug: slug, shopName: shop.name, listing: { id: saved.id, title: saved.title }, now });
      }
      return saved.id;
    },
    async addReport(reporter, { kind, id }) {
      const store = sampleStore();
      const reporterId = await this.signedIn(reporter);
      const listing = kind === "listing" ? store.listings.get(id) : undefined;
      const shop = kind === "seller" ? store.sellers.get(id) : listing ? store.sellers.get(listing.sellerSlug) : undefined;
      const request = kind === "request" ? store.requests.get(id) : undefined;
      const title = listing?.title ?? request?.title ?? shop?.name;
      if (!title) throw new Error(`Nothing to report: ${kind} ${id}`);
      const reportId = `report-contract-${store.reports.size + 1}`;
      store.reports.set(reportId, {
        id: reportId,
        reporterId,
        targetKind: kind,
        targetId: id,
        targetTitle: title,
        reason: "spam",
        detail: "",
        status: "open",
        createdAt: new Date().toISOString(),
        targetOwnerId: kind === "request" ? (request?.askerId ?? null) : (shop?.ownerId ?? null),
      });
      return reportId;
    },
    async saveSearch(name, search, { paused = false, at } = {}) {
      const accountId = await this.signedIn(name);
      const store = sampleStore();
      const id = `ss-contract-${store.savedSearches.size + 1}`;
      const made = (at ?? new Date(Date.now() + store.savedSearches.size)).toISOString();
      store.savedSearches.set(id, {
        id,
        accountId,
        q: null,
        category: null,
        campus: ALL_CAMPUSES,
        price: null,
        pay: null,
        deals: null,
        ...search,
        createdAt: made,
        pausedAt: paused ? made : null,
      });
      return id;
    },
    async fillFollows(follower, count) {
      const accountId = await this.signedIn(follower);
      const store = sampleStore();
      const at = new Date().toISOString();
      for (let n = 1; n <= count; n += 1) {
        const slug = `contract-fill-${store.sellers.size + 1}`;
        store.sellers.set(slug, shopRow(slug, `Contract fill ${n}`, null, "pretoria", at, []));
        const id = `follow-contract-fill-${n}`;
        store.follows.set(id, { id, accountId, sellerSlug: slug, createdAt: at });
      }
    },
    async setMentor(slug, mentor) {
      const store = sampleStore();
      const ownerId = store.sellers.get(slug)?.ownerId;
      const profile = ownerId ? store.sellerProfiles.get(ownerId) : undefined;
      if (!profile) throw new Error(`No owned shop ${slug}`);
      profile.mentorId = mentor ? await this.signedIn(mentor) : null;
    },
    async auditCount() {
      return sampleStore().auditLog.size;
    },
    async addOffer(slug, requestId, body) {
      const request = sampleStore().requests.get(requestId);
      if (!request?.askerId) throw new Error(`No asker's request ${requestId}`);
      return startOffer({
        askerId: request.askerId,
        request: { id: request.id, title: request.title },
        sellerSlug: slug,
        listing: null,
        body,
        now: new Date(),
      });
    },
    async offerFromGoneShop(requestId, body) {
      const store = sampleStore();
      const id = `acc-contract-gone-${randomUUID()}`;
      const at = new Date().toISOString();
      store.accounts.set(id, {
        id,
        email: `contract-gone-${id.slice(-12)}@vossie.test`,
        firstName: "Gone",
        campusSlug: "pretoria",
        roles: [],
        createdAt: at,
      });
      const slug = freeSlug("Contract gone shop");
      store.sellers.set(slug, shopRow(slug, "Contract gone shop", id, "pretoria", at, []));
      store.sellerProfiles.set(id, { accountId: id, status: "approved", sellerSlug: slug, appliedAt: at, approvedAt: at });
      const conversation = await this.addOffer(slug, requestId, body);
      await this.addMessages(conversation, "buyer", 1, new Date());
      await deleteAccountData(id);
      return conversation;
    },
    async tidyCommunity() {
      // Nothing to tidy: the next test's world starts from a fresh store.
    },
    async tidyPickupPoints() {
      // Nothing to tidy: the next test's world starts from a fresh store.
    },
    async deleteListing(id) {
      if (!sampleStore().listings.delete(id)) throw new Error(`No listing ${id}`);
    },
    async closeShop(slug) {
      const store = sampleStore();
      if (!store.sellers.delete(slug)) throw new Error(`No shop ${slug}`);
      const gone = new Set<string>();
      for (const [id, listing] of store.listings) {
        if (listing.sellerSlug !== slug) continue;
        gone.add(id);
        store.listings.delete(id);
      }
      // As forgetShopOf leaves them (amendment 13.1).
      for (const report of store.reports.values()) {
        if (report.targetKind === "seller" ? report.targetId === slug : report.targetKind === "listing" && gone.has(report.targetId)) {
          report.targetGone = true;
        }
      }
      for (const [id, pin] of store.featuredPins) if (pin.sellerSlug === slug) store.featuredPins.delete(id);
    },
    async tidyStaffTools() {
      // Nothing to tidy: the next test's world starts from a fresh store.
    },
    async photoStored(src) {
      return sampleStore().photos.has(photoIdOf(src) ?? "");
    },
    async onlyAdmins(names) {
      const keep = new Set(await Promise.all(names.map((name) => this.signedIn(name))));
      for (const row of sampleStore().accounts.values()) {
        const others = row.roles.filter((role) => role !== "admin");
        row.roles = keep.has(row.id) ? [...others, "admin"] : others;
      }
    },
    async addPastActivity(slug, at, closedAt) {
      const store = sampleStore();
      const [askerId, sellerId, staffId] = await Promise.all([this.signedIn("asker"), this.signedIn("seller"), this.signedIn("staff")]);
      const id = await this.addRequest({ asker: "asker", title: "A contract request from last week", neededBy: null });
      Object.assign(store.requests.get(id)!, { createdAt: at.toISOString(), updatedAt: at.toISOString() });
      const followId = `follow-contract-past-${store.follows.size + 1}`;
      store.follows.set(followId, { id: followId, accountId: askerId, sellerSlug: slug, createdAt: at.toISOString() });
      const reportId = `report-contract-past-${store.reports.size + 1}`;
      store.reports.set(reportId, {
        id: reportId,
        reporterId: sellerId,
        targetKind: "request",
        targetId: id,
        targetTitle: "A contract request from last week",
        reason: "spam",
        detail: "",
        status: "closed",
        createdAt: at.toISOString(),
        outcome: "dismissed",
        note: "Nothing wrong.",
        closedAt: closedAt.toISOString(),
        closedBy: staffId,
        targetOwnerId: askerId,
      });
    },
    async cleanup() {
      // Nothing to undo: the next test's world starts from a fresh store.
    },
  };
}
