import { photoIdOf } from "@/lib/data/photos";
import type { AccountRow } from "@/lib/data/rows";
import { resetSampleStore, sampleStore } from "@/lib/data/store";
import { SLUG_MAX, slugify } from "@/lib/selling/rules";
import { sastDate } from "@/lib/time";
import type { NotificationKind } from "@/lib/types";
import type { World, WorldAccountName } from "./world";

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
        slug,
        ownerId,
        name: title,
        tagline: "A shop the contract tests open.",
        categorySlug: "tech",
        campusSlug: campus,
        verified: false,
        badge: "new-seller",
        about: "A shop the contract tests open and close again.",
        since: sastDate(now).slice(0, 7),
        image: null,
        pickupPointIds: status === "pending" || !point ? [] : [point.id],
        slugChanged: false,
        previousSlugs: [],
        createdAt: at,
        updatedAt: at,
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
    async follow(follower, slug) {
      const accountId = await this.signedIn(follower);
      const follows = sampleStore().follows;
      const id = `follow-contract-${follows.size + 1}`;
      follows.set(id, { id, accountId, sellerSlug: slug, createdAt: new Date().toISOString() });
    },
    async addNotification(name, note) {
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
        createdAt: new Date().toISOString(),
        readAt: null,
      });
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
    async cleanup() {
      // Nothing to undo: the next test's world starts from a fresh store.
    },
  };
}
