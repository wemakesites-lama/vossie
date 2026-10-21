import { randomUUID } from "node:crypto";
import { inject } from "vitest";
import { ALL_CAMPUSES } from "@/lib/campus";
import { campusToDb } from "@/lib/data/supabase/rows";
import { saleNoteText } from "@/lib/messaging/notification-text";
import { threadPath } from "@/lib/messaging/paths";
import { searchKey } from "@/lib/saved-searches/rules";
import { SLUG_MAX, slugify } from "@/lib/selling/rules";
import { sastDate } from "@/lib/time";
import type { Account, SellerStatus } from "@/lib/types";
import { listingFields, WORLD_ACCOUNTS, type World, type WorldAccountName } from "@/tests/contract/world";
import { testAdminClient, type DbClient } from "./accounts";
import { sql } from "./sql";
import { sessionClient, withViewer } from "./viewer";

/** The photos bucket (spec section 6). */
const BUCKET = "photos";

/** A photo's database id from its address (/photos/<uuid>), or the address itself when it isn't one. */
const photoIdIn = (src: string) => src.replace(/^\/photos\//, "");

/** The Auth session id in an access token's claims (session_id), read without checking: the test's own token. */
function sessionIdOf(accessToken: string): string {
  const payload = JSON.parse(Buffer.from(accessToken.split(".")[1], "base64url").toString("utf8")) as { session_id?: unknown };
  if (typeof payload.session_id !== "string") throw new Error("The test session's token has no session_id");
  return payload.session_id;
}

// The local stack's world (2b plan decision 18, Task 13). Its accounts are the global setup's (tests/db/global-setup.ts).
// Its verbs write with the admin client, never through a function a test is checking, and each records an undo with
// undoLater(), which cleanup() runs newest first after each test, so the seed is the same after every test.

export type SupabaseWorld = World & {
  /** The secret key's client, for verbs and for checking what a function wrote. */
  readonly admin: DbClient;
  /** Records how to undo a write; cleanup() runs the undos newest first. */
  undoLater(undo: () => Promise<void>): void;
  /** Whether the photos bucket has a file at this path (C2/C3 plan Task 5). */
  fileExists(path: string): Promise<boolean>;
  /**
   * Uploads a file no photo row names, `ageHours` old (its storage.objects time moved back as postgres), as a removal
   * that failed would leave (C2/C3 plan Tasks 5 and 7). Removed in cleanup if it's still there.
   */
  orphanFile(path: string, ageHours: number): Promise<void>;
  /** A Hub tip with this stored cover, published or not; its id (C2/C3 plan Task 5). Deleted in cleanup. */
  addHubPost(post: { published: boolean; coverSrc: string }): Promise<string>;
};

/** A Supabase world. Made before each test. */
export function supabaseWorld(): SupabaseWorld {
  const admin = testAdminClient();
  let undos: (() => Promise<void>)[] = [];
  /** A shop's id by its slug. */
  async function shopId(slug: string): Promise<string> {
    const shop = await admin.from("shops").select("id").eq("slug", slug).single();
    if (shop.error) throw new Error(`No shop ${slug}: ${shop.error.message}`);
    return shop.data.id;
  }
  /** Every file in the bucket under `folder` (an account's id), as paths. */
  async function filesUnder(folder: string): Promise<string[]> {
    const paths: string[] = [];
    for (let offset = 0; ; offset += 1_000) {
      const { data, error } = await admin.storage.from(BUCKET).list(folder, { limit: 1_000, offset });
      if (error) throw new Error(error.message);
      paths.push(...data.map((file) => `${folder}/${file.name}`));
      if (data.length < 1_000) return paths;
    }
  }
  /** Removes files from the bucket, 100 at a time. */
  async function removeFiles(paths: readonly string[]): Promise<void> {
    for (let from = 0; from < paths.length; from += 100) {
      const { error } = await admin.storage.from(BUCKET).remove(paths.slice(from, from + 100));
      if (error) throw new Error(error.message);
    }
  }
  /** A link no shop has or had, from the name, as private.free_shop_slug makes one. */
  async function freeSlug(name: string): Promise<string> {
    for (let n = 1; ; n += 1) {
      const suffix = n === 1 ? "" : `-${n}`;
      const slug = `${slugify(name).slice(0, SLUG_MAX - suffix.length).replace(/-+$/, "")}${suffix}`;
      const [shops, previous] = await Promise.all([
        admin.from("shops").select("id").eq("slug", slug),
        admin.from("shop_previous_slugs").select("slug").eq("slug", slug),
      ]);
      if (shops.error || previous.error) throw new Error((shops.error ?? previous.error)!.message);
      if (shops.data.length === 0 && previous.data.length === 0) return slug;
    }
  }
  /** The world account that owns the shop, for a verb that acts with the owner's session. */
  async function ownerOf(slug: string): Promise<{ name: WorldAccountName; shopId: string }> {
    const shop = await admin.from("shops").select("id, owner_id").eq("slug", slug).single();
    if (shop.error) throw new Error(`No shop ${slug}: ${shop.error.message}`);
    const sessions = inject("dbSessions");
    const name = WORLD_ACCOUNTS.find((account) => sessions[account].id === shop.data.owner_id);
    if (!name) throw new Error(`${slug} isn't a world account's shop`);
    return { name, shopId: shop.data.id };
  }
  /** Fails the verb with the database's error. */
  function check<T extends { error: { message: string } | null }>(result: T, what: string): T {
    if (result.error) throw new Error(`${what}: ${result.error.message}`);
    return result;
  }
  /** Saved searches are a millisecond apart, so the oldest is the one made first. */
  let searchesMade = 0;
  return {
    name: "supabase",
    admin,
    undoLater(undo) {
      undos.push(undo);
    },
    async signedIn(name) {
      return inject("dbSessions")[name].id;
    },
    async asViewer(name, read) {
      // Its own viewer for the length of the call, whatever else runs at the same time (C4/C5 plan amendment 7).
      const accountId = await this.signedIn(name);
      return withViewer(name, async () => read(accountId));
    },
    async hideListing(id, reason) {
      const hidden = await admin
        .from("listings")
        .update({ hidden_at: new Date().toISOString(), hidden_reason: reason })
        .eq("id", id)
        .is("hidden_at", null)
        .select("id");
      if (hidden.error) throw new Error(hidden.error.message);
      if (hidden.data.length !== 1) throw new Error(`No shown listing ${id}`);
      undos.push(async () => {
        const undone = await admin.from("listings").update({ hidden_at: null, hidden_reason: null }).eq("id", id);
        if (undone.error) throw new Error(undone.error.message);
      });
    },
    async pauseShop(slug, by) {
      const shop = await admin.from("shops").select("owner_id").eq("slug", slug).single();
      if (shop.error) throw new Error(shop.error.message);
      const owner = shop.data.owner_id;
      if (!owner) throw new Error(`No owned shop ${slug}`);
      const before = await admin.from("seller_profiles").select("status, paused_by").eq("account_id", owner).single();
      if (before.error) throw new Error(before.error.message);
      const paused = await admin.from("seller_profiles").update({ status: "paused", paused_by: by }).eq("account_id", owner);
      if (paused.error) throw new Error(paused.error.message);
      undos.push(async () => {
        const undone = await admin.from("seller_profiles").update(before.data).eq("account_id", owner);
        if (undone.error) throw new Error(undone.error.message);
      });
    },
    async draftListing(id) {
      const before = await admin.from("listings").select("state").eq("id", id).single();
      if (before.error) throw new Error(before.error.message);
      const drafted = await admin.from("listings").update({ state: "draft" }).eq("id", id);
      if (drafted.error) throw new Error(drafted.error.message);
      undos.push(async () => {
        const undone = await admin.from("listings").update({ state: before.data.state }).eq("id", id);
        if (undone.error) throw new Error(undone.error.message);
      });
    },
    async addRsvp(postId, name) {
      const accountId = await this.signedIn(name);
      const added = await admin.from("hub_rsvps").insert({ post_id: postId, account_id: accountId });
      if (added.error) throw new Error(added.error.message);
      undos.push(async () => {
        const undone = await admin.from("hub_rsvps").delete().eq("post_id", postId).eq("account_id", accountId);
        if (undone.error) throw new Error(undone.error.message);
      });
    },
    async unpublishPost(id) {
      const drafted = await admin.from("hub_posts").update({ published: false }).eq("id", id).eq("published", true).select("id");
      if (drafted.error) throw new Error(drafted.error.message);
      if (drafted.data.length !== 1) throw new Error(`No published Hub post ${id}`);
      undos.push(async () => {
        const undone = await admin.from("hub_posts").update({ published: true }).eq("id", id);
        if (undone.error) throw new Error(undone.error.message);
      });
    },
    async addRequest({ asker, title, neededBy }) {
      const added = await admin
        .from("requests")
        .insert({
          asker_id: await this.signedIn(asker),
          title,
          details: "A request the contract tests post and the world takes away again.",
          category_slug: "tech",
          campus_slug: "pretoria",
          needed_by: neededBy,
        })
        .select("id")
        .single();
      if (added.error) throw new Error(added.error.message);
      const id = added.data.id;
      undos.push(async () => {
        // What the settle told the asker about it goes with it (notifications name their subject by id, no key).
        const told = await admin.from("notifications").delete().eq("subject_id", id).eq("kind", "request-update");
        if (told.error) throw new Error(told.error.message);
        const undone = await admin.from("requests").delete().eq("id", id);
        if (undone.error) throw new Error(undone.error.message);
      });
      return id;
    },
    async notificationsOf(name) {
      const { data, error } = await admin
        .from("notifications")
        .select("kind, subject_id, text, href")
        .eq("account_id", await this.signedIn(name))
        .order("created_at")
        .order("id");
      if (error) throw new Error(error.message);
      return data.map((row) => ({ kind: row.kind, subjectId: row.subject_id, text: row.text, href: row.href }));
    },
    async retirePickupPoint(id) {
      const before = await admin.from("pickup_points").select("retired_at").eq("id", id).single();
      if (before.error) throw new Error(before.error.message);
      const retired = await admin.from("pickup_points").update({ retired_at: new Date().toISOString() }).eq("id", id);
      if (retired.error) throw new Error(retired.error.message);
      undos.push(async () => {
        const undone = await admin.from("pickup_points").update({ retired_at: before.data.retired_at }).eq("id", id);
        if (undone.error) throw new Error(undone.error.message);
      });
    },
    async recordDraw(campus, day, slugs) {
      const shopIds = await Promise.all(slugs.map(shopId));
      const added = await admin
        .from("featured_draws")
        .insert({ campus_slug: campusToDb(campus), day, shop_ids: shopIds })
        .select("id")
        .single();
      if (added.error) throw new Error(added.error.message);
      const id = added.data.id;
      undos.push(async () => {
        const undone = await admin.from("featured_draws").delete().eq("id", id);
        if (undone.error) throw new Error(undone.error.message);
      });
    },
    async addPin(campus, day, slug) {
      const added = await admin
        .from("featured_pins")
        .insert({ shop_id: await shopId(slug), campus_slug: campusToDb(campus), day, pinned_by: await this.signedIn("staff") })
        .select("id")
        .single();
      if (added.error) throw new Error(added.error.message);
      const id = added.data.id;
      undos.push(async () => {
        const undone = await admin.from("featured_pins").delete().eq("id", id);
        if (undone.error) throw new Error(undone.error.message);
      });
    },
    async unverifyShop(slug) {
      const unverified = await admin.from("shops").update({ verified: false }).eq("slug", slug).eq("verified", true).select("id");
      if (unverified.error) throw new Error(unverified.error.message);
      if (unverified.data.length !== 1) throw new Error(`No Verified shop ${slug}`);
      undos.push(async () => {
        const undone = await admin.from("shops").update({ verified: true }).eq("slug", slug);
        if (undone.error) throw new Error(undone.error.message);
      });
    },
    async forgetFeaturedDays(days) {
      const forget = [...days];
      undos.push(async () => {
        const draws = await admin.from("featured_draws").delete().in("day", forget);
        if (draws.error) throw new Error(draws.error.message);
        const pins = await admin.from("featured_pins").delete().in("day", forget);
        if (pins.error) throw new Error(pins.error.message);
      });
    },
    async keepBadges() {
      const before = await admin.from("shops").select("id, badge");
      if (before.error) throw new Error(before.error.message);
      const kept = before.data;
      undos.push(async () => {
        const now = await admin.from("shops").select("id, badge");
        if (now.error) throw new Error(now.error.message);
        const current = new Map(now.data.map((row) => [row.id, row.badge]));
        for (const row of kept) {
          if (current.get(row.id) === row.badge) continue;
          const undone = await admin.from("shops").update({ badge: row.badge }).eq("id", row.id);
          if (undone.error) throw new Error(undone.error.message);
        }
      });
    },
    async tidySelling(owner) {
      const hub = owner === "hub";
      const accountId = hub ? null : await this.signedIn(owner as WorldAccountName);
      const photosOf = () => {
        const query = admin.from("photos").select("id, path");
        return accountId ? query.eq("owner_id", accountId) : query.is("owner_id", null);
      };
      const before = await photosOf();
      if (before.error) throw new Error(before.error.message);
      const kept = new Set(before.data.map((row) => row.id));
      let hadShop = true;
      let hadDraft = true;
      if (accountId) {
        const [profile, draft] = await Promise.all([
          admin.from("seller_profiles").select("account_id").eq("account_id", accountId),
          admin.from("onboarding_drafts").select("account_id").eq("account_id", accountId),
        ]);
        if (profile.error || draft.error) throw new Error((profile.error ?? draft.error)!.message);
        hadShop = profile.data.length > 0;
        hadDraft = draft.data.length > 0;
      }
      undos.push(async () => {
        if (accountId && !hadShop) {
          const shops = await admin.from("shops").delete().eq("owner_id", accountId);
          if (shops.error) throw new Error(shops.error.message);
          const profile = await admin.from("seller_profiles").delete().eq("account_id", accountId);
          if (profile.error) throw new Error(profile.error.message);
        }
        if (accountId && !hadDraft) {
          const draft = await admin.from("onboarding_drafts").delete().eq("account_id", accountId);
          if (draft.error) throw new Error(draft.error.message);
        }
        const after = await photosOf();
        if (after.error) throw new Error(after.error.message);
        const made = after.data.filter((row) => !kept.has(row.id));
        if (made.length > 0) {
          const gone = await admin.from("photos").delete().in("id", made.map((row) => row.id));
          if (gone.error) throw new Error(gone.error.message);
        }
        if (accountId) {
          // The account's folder is the contract account's own: any file no kept row names is the test's.
          const named = new Set(after.data.filter((row) => kept.has(row.id)).map((row) => row.path));
          await removeFiles((await filesUnder(accountId)).filter((path) => !named.has(path)));
        } else {
          // hub/ is every session's: only the files of the rows this test made go, never a file another session is
          // uploading before its row is in (fix 4 of the review after C2 and C3).
          await removeFiles(made.map((row) => row.path));
        }
      });
    },
    async ageWaitingPhoto(src, hours) {
      const aged = await admin
        .from("photos")
        .update({ created_at: new Date(Date.now() - hours * 60 * 60 * 1000).toISOString() })
        .eq("id", photoIdIn(src))
        .select("id");
      if (aged.error) throw new Error(aged.error.message);
      if (aged.data.length !== 1) throw new Error(`No photo ${src}`);
      // The photo is the test's own: tidySelling takes it away.
    },
    async openShop(name, { name: shopName, campus = "pretoria", status = "approved", pausedBy } = {}) {
      const ownerId = await this.signedIn(name);
      const title = shopName ?? `Contract ${name[0].toUpperCase()}${name.slice(1)}'s shop`;
      const slug = await freeSlug(title);
      const now = new Date();
      const shop = await admin
        .from("shops")
        .insert({
          slug,
          owner_id: ownerId,
          name: title,
          tagline: "A shop the contract tests open.",
          category_slug: "tech",
          campus_slug: campus,
          verified: false,
          badge: "new-seller",
          about: "A shop the contract tests open and close again.",
          since: sastDate(now).slice(0, 7),
        })
        .select("id")
        .single();
      if (shop.error) throw new Error(shop.error.message);
      const id = shop.data.id;
      undos.push(async () => {
        const profile = await admin.from("seller_profiles").delete().eq("account_id", ownerId);
        if (profile.error) throw new Error(profile.error.message);
        const undone = await admin.from("shops").delete().eq("id", id);
        if (undone.error) throw new Error(undone.error.message);
      });
      const profile = await admin.from("seller_profiles").insert({
        account_id: ownerId,
        status,
        shop_id: id,
        paused_by: status === "paused" ? (pausedBy ?? "seller") : null,
        approved_at: status === "pending" ? null : now.toISOString(),
      });
      if (profile.error) throw new Error(profile.error.message);
      if (status !== "pending") {
        const point = await admin
          .from("pickup_points")
          .select("id")
          .eq("campus_slug", campus)
          .is("retired_at", null)
          .order("created_at")
          .order("name")
          .order("id")
          .limit(1);
        if (point.error) throw new Error(point.error.message);
        if (point.data.length > 0) {
          const used = await admin.from("shop_pickup_points").insert({ shop_id: id, pickup_point_id: point.data[0].id });
          if (used.error) throw new Error(used.error.message);
        }
      }
      return slug;
    },
    async follow(follower, slug) {
      const added = await admin
        .from("follows")
        .insert({ account_id: await this.signedIn(follower), shop_id: await shopId(slug) })
        .select("id")
        .single();
      if (added.error) throw new Error(added.error.message);
      const id = added.data.id;
      undos.push(async () => {
        const undone = await admin.from("follows").delete().eq("id", id);
        if (undone.error) throw new Error(undone.error.message);
      });
    },
    async addNotification(name, note, at = new Date()) {
      const added = await admin
        .from("notifications")
        .insert({
          account_id: await this.signedIn(name),
          kind: note.kind,
          subject_id: note.subjectId,
          text: note.text,
          href: note.href,
          created_at: at.toISOString(),
        })
        .select("id")
        .single();
      if (added.error) throw new Error(added.error.message);
      const id = added.data.id;
      undos.push(async () => {
        const undone = await admin.from("notifications").delete().eq("id", id);
        if (undone.error) throw new Error(undone.error.message);
      });
    },
    async tidyMessaging() {
      const accounts = WORLD_ACCOUNTS.map((name) => inject("dbSessions")[name].id);
      const [conversations, notes, reports] = await Promise.all([
        admin.from("conversations").select("id"),
        admin.from("notifications").select("id").in("account_id", accounts),
        admin.from("reports").select("id").in("reporter_id", accounts),
      ]);
      if (conversations.error || notes.error || reports.error) {
        throw new Error((conversations.error ?? notes.error ?? reports.error)!.message);
      }
      const keptConversations = new Set(conversations.data.map((row) => row.id));
      const keptNotes = new Set(notes.data.map((row) => row.id));
      const keptReports = new Set(reports.data.map((row) => row.id));
      undos.push(async () => {
        // The conversations the test made: a world account's as the buyer or as the shop, or one whose buyer or shop has
        // gone (a verb's, or a shop the test opened and has closed again). Their messages go with them.
        const [now, shops] = await Promise.all([
          admin.from("conversations").select("id, buyer_id, shop_id"),
          admin.from("shops").select("id").in("owner_id", accounts),
        ]);
        if (now.error || shops.error) throw new Error((now.error ?? shops.error)!.message);
        const theirShops = new Set(shops.data.map((row) => row.id));
        const made = now.data
          .filter((row) => !keptConversations.has(row.id))
          .filter(
            (row) =>
              row.buyer_id === null ||
              accounts.includes(row.buyer_id) ||
              row.shop_id === null ||
              theirShops.has(row.shop_id),
          )
          .map((row) => row.id);
        const after = await admin.from("notifications").select("id").in("account_id", accounts);
        if (after.error) throw new Error(after.error.message);
        const madeNotes = after.data.filter((row) => !keptNotes.has(row.id)).map((row) => row.id);
        for (let from = 0; from < madeNotes.length; from += 100) {
          const gone = await admin.from("notifications").delete().in("id", madeNotes.slice(from, from + 100));
          if (gone.error) throw new Error(gone.error.message);
        }
        for (let from = 0; from < made.length; from += 100) {
          const gone = await admin.from("conversations").delete().in("id", made.slice(from, from + 100));
          if (gone.error) throw new Error(gone.error.message);
        }
        const reported = await admin.from("reports").select("id").in("reporter_id", accounts);
        if (reported.error) throw new Error(reported.error.message);
        const madeReports = reported.data.filter((row) => !keptReports.has(row.id)).map((row) => row.id);
        if (madeReports.length > 0) {
          const gone = await admin.from("reports").delete().in("id", madeReports);
          if (gone.error) throw new Error(gone.error.message);
        }
      });
    },
    async addConversation({ buyer, slug, listingId, listingTitle, offerOn, status, messages }) {
      const shop = await shopId(slug);
      let title = listingTitle ?? null;
      if (listingId) {
        const listing = await admin.from("listings").select("title").eq("id", listingId).single();
        if (listing.error) throw new Error(`No listing ${listingId}: ${listing.error.message}`);
        title = listing.data.title;
      }
      let requestTitle: string | null = null;
      if (offerOn) {
        const request = await admin.from("requests").select("title").eq("id", offerOn).single();
        if (request.error) throw new Error(`No request ${offerOn}: ${request.error.message}`);
        requestTitle = request.data.title;
      }
      const first = messages[0]?.sentAt ?? new Date();
      const last = messages.at(-1)?.sentAt ?? first;
      const sellerFirst = messages.find((message) => message.side === "seller");
      const added = await admin
        .from("conversations")
        .insert({
          listing_id: listingId ?? null,
          listing_title: title,
          shop_id: shop,
          buyer_id: await this.signedIn(buyer),
          status: status ?? (offerOn ? "offered" : sellerFirst ? "replied" : "asked"),
          created_at: first.toISOString(),
          last_message_at: last.toISOString(),
          first_reply_at: !offerOn && sellerFirst ? sellerFirst.sentAt.toISOString() : null,
          is_offer: Boolean(offerOn),
          request_id: offerOn ?? null,
          request_title: requestTitle,
        })
        .select("id")
        .single();
      if (added.error) throw new Error(added.error.message);
      const id = added.data.id;
      // tidyMessaging takes it away, with its messages.
      if (messages.length > 0) {
        const sent = await admin.from("messages").insert(
          messages.map((message) => ({
            conversation_id: id,
            side: message.side,
            body: message.body,
            sent_at: message.sentAt.toISOString(),
            read_at: message.readAt ? message.readAt.toISOString() : null,
          })),
        );
        if (sent.error) throw new Error(sent.error.message);
      }
      return id;
    },
    async addMessages(conversationId, side, count, sentAt) {
      const rows = Array.from({ length: count }, (_, n) => ({
        conversation_id: conversationId,
        side,
        body: `Message ${n + 1}`,
        sent_at: sentAt.toISOString(),
      }));
      for (let from = 0; from < rows.length; from += 500) {
        const sent = await admin.from("messages").insert(rows.slice(from, from + 500));
        if (sent.error) throw new Error(sent.error.message);
      }
      const row = await admin.from("conversations").select("last_message_at").eq("id", conversationId).single();
      if (row.error) throw new Error(row.error.message);
      if (Date.parse(row.data.last_message_at) < sentAt.getTime()) {
        const moved = await admin.from("conversations").update({ last_message_at: sentAt.toISOString() }).eq("id", conversationId);
        if (moved.error) throw new Error(moved.error.message);
      }
    },
    async markDone(conversationId, completedAt) {
      const row = await admin
        .from("conversations")
        .select("buyer_id, shop_id, listing_title, request_title")
        .eq("id", conversationId)
        .single();
      if (row.error) throw new Error(row.error.message);
      if (!row.data.buyer_id) throw new Error(`No buyer in ${conversationId}`);
      const shop = row.data.shop_id ? await admin.from("shops").select("name").eq("id", row.data.shop_id).single() : null;
      if (shop?.error) throw new Error(shop.error.message);
      const done = await admin
        .from("conversations")
        .update({ status: "done", completed_at: completedAt.toISOString() })
        .eq("id", conversationId);
      if (done.error) throw new Error(done.error.message);
      const told = await admin.from("notifications").insert({
        account_id: row.data.buyer_id,
        kind: "sale-to-confirm",
        subject_id: conversationId,
        text: saleNoteText({
          shop: shop?.data.name ?? "A closed shop",
          listingTitle: row.data.request_title ?? row.data.listing_title,
        }),
        href: threadPath(conversationId),
        created_at: completedAt.toISOString(),
      });
      if (told.error) throw new Error(told.error.message);
    },
    async sellerGone(conversationId) {
      const gone = await admin.from("conversations").update({ seller_gone: true }).eq("id", conversationId).select("id");
      if (gone.error) throw new Error(gone.error.message);
      if (gone.data.length !== 1) throw new Error(`No conversation ${conversationId}`);
    },
    async shopGone(conversationId) {
      // As forget_account leaves it: the shop row's deletion sets shop_id null (on delete set null). The shop itself is
      // the test's, and tidySelling takes it away.
      const gone = await admin
        .from("conversations")
        .update({ seller_gone: true, shop_id: null })
        .eq("id", conversationId)
        .select("id");
      if (gone.error) throw new Error(gone.error.message);
      if (gone.data.length !== 1) throw new Error(`No conversation ${conversationId}`);
    },
    async buyerGone(conversationId) {
      const gone = await admin
        .from("conversations")
        .update({ buyer_id: null })
        .eq("id", conversationId)
        .select("id");
      if (gone.error) throw new Error(gone.error.message);
      if (gone.data.length !== 1) throw new Error(`No conversation ${conversationId}`);
    },
    async hideRequest(id, reason) {
      const hidden = await admin
        .from("requests")
        .update({ hidden_at: new Date().toISOString(), hidden_reason: reason })
        .eq("id", id)
        .is("hidden_at", null)
        .select("id");
      if (hidden.error) throw new Error(hidden.error.message);
      if (hidden.data.length !== 1) throw new Error(`No shown request ${id}`);
      undos.push(async () => {
        const undone = await admin.from("requests").update({ hidden_at: null, hidden_reason: null }).eq("id", id);
        if (undone.error) throw new Error(undone.error.message);
      });
    },
    async onceRow(name, form, { taken = false, expiresInMinutes = 60 } = {}) {
      const session = inject("dbSessions")[name];
      const sessionId = sessionIdOf(session.accessToken);
      const added = await admin.from("form_states").upsert(
        {
          session_id: sessionId,
          form,
          account_id: session.id,
          errors: [],
          values: {},
          notice: null,
          expires_at: new Date(Date.now() + expiresInMinutes * 60 * 1000).toISOString(),
          taken,
        },
        { onConflict: "session_id,form" },
      );
      if (added.error) throw new Error(added.error.message);
      undos.push(async () => {
        const undone = await admin.from("form_states").delete().eq("session_id", sessionId).eq("form", form);
        if (undone.error) throw new Error(undone.error.message);
      });
      return sessionId;
    },
    async fileExists(path) {
      const slash = path.lastIndexOf("/");
      const { data, error } = await admin.storage.from(BUCKET).list(path.slice(0, slash), { search: path.slice(slash + 1) });
      if (error) throw new Error(error.message);
      return data.some((file) => file.name === path.slice(slash + 1));
    },
    async orphanFile(path, ageHours) {
      const { error } = await admin.storage
        .from(BUCKET)
        .upload(path, new Uint8Array([0xff, 0xd8, 0xff, 0xd9]), { contentType: "image/jpeg", upsert: false });
      if (error) throw new Error(error.message);
      undos.push(async () => {
        const undone = await admin.storage.from(BUCKET).remove([path]);
        if (undone.error) throw new Error(undone.error.message);
      });
      sql(
        `update storage.objects set created_at = now() - make_interval(hours => :'hours'::int)
         where bucket_id = 'photos' and name = :'path'`,
        { hours: String(ageHours), path },
      );
    },
    async addHubPost({ published, coverSrc }) {
      const cover = photoIdIn(coverSrc);
      const added = await admin
        .from("hub_posts")
        .insert({
          kind: "tip",
          title: "Contract cover tip",
          summary: "A tip the contract tests post and take away again.",
          body: "A tip the contract tests post and take away again.",
          cover_photo_id: cover,
          published,
          published_at: published ? new Date().toISOString() : null,
        })
        .select("id")
        .single();
      if (added.error) throw new Error(added.error.message);
      const id = added.data.id;
      undos.push(async () => {
        const undone = await admin.from("hub_posts").delete().eq("id", id);
        if (undone.error) throw new Error(undone.error.message);
      });
      const used = await admin.from("photos").update({ use: `post:${id}` }).eq("id", cover);
      if (used.error) throw new Error(used.error.message);
      return id;
    },
    async setRoles(name, roles) {
      const id = await this.signedIn(name);
      const before = check(await admin.from("profiles").select("roles").eq("id", id).single(), "Reading roles");
      check(await admin.from("profiles").update({ roles: [...roles] }).eq("id", id), "Setting roles");
      undos.push(async () => {
        check(await admin.from("profiles").update({ roles: before.data!.roles }).eq("id", id), "Putting roles back");
      });
    },
    async viewerAccount(name) {
      const session = inject("dbSessions")[name];
      const [profile, seller] = await Promise.all([
        admin.from("profiles").select("id, first_name, campus_slug, roles, created_at").eq("id", session.id).single(),
        admin.from("seller_profiles").select("status, shop_id").eq("account_id", session.id).maybeSingle(),
      ]);
      check(profile, "Reading the profile");
      check(seller, "Reading the seller profile");
      let sellerSlug: string | null = null;
      if (seller.data && seller.data.status !== "pending" && seller.data.shop_id) {
        sellerSlug = check(await admin.from("shops").select("slug").eq("id", seller.data.shop_id).single(), "Reading the shop")
          .data!.slug;
      }
      return {
        id: profile.data!.id,
        email: `contract-${name}@vossie.test`,
        firstName: profile.data!.first_name,
        campusSlug: profile.data!.campus_slug,
        roles: profile.data!.roles as Account["roles"],
        seller: seller.data ? { status: seller.data.status as SellerStatus, sellerSlug } : null,
        createdAt: new Date(profile.data!.created_at).toISOString(),
      };
    },
    async addListing(slug, listing) {
      const shop = check(await admin.from("shops").select("id, category_slug, campus_slug").eq("slug", slug).single(), `No shop ${slug}`);
      const f = listingFields(listing, shop.data!.category_slug);
      const now = new Date().toISOString();
      const added = check(
        await admin
          .from("listings")
          .insert({
            shop_id: shop.data!.id,
            state: "available",
            kind: f.kind,
            title: f.title,
            category_slug: f.categorySlug,
            condition: f.condition,
            price_zar: f.priceZar,
            price_is_from: f.priceIsFrom,
            pay_mode: f.payMode,
            description: f.description,
            handover: f.handover,
            pickup_point_id: f.pickupPointId,
            campus_slug: shop.data!.campus_slug,
            created_at: now,
            first_published_at: now,
          })
          .select("id")
          .single(),
        "Listing",
      );
      const id = added.data!.id;
      undos.push(async () => {
        check(await admin.from("listings").delete().eq("id", id), "Taking the listing away");
      });
      return id;
    },
    async publishListing(owner, slug, listing) {
      const { name, shopId } = await ownerOf(slug);
      if (name !== owner) throw new Error(`${owner} doesn't own ${slug}`);
      const shop = check(await admin.from("shops").select("category_slug").eq("id", shopId).single(), "Reading the shop");
      const f = listingFields(listing, shop.data!.category_slug);
      const { data, error } = await sessionClient(inject("dbSessions")[owner].accessToken).rpc("save_listing", {
        p_listing_id: null as unknown as string,
        p_kind: f.kind,
        p_title: f.title,
        p_category_slug: f.categorySlug,
        p_condition: f.condition,
        p_price_zar: f.priceZar,
        p_price_is_from: f.priceIsFrom,
        p_pay_mode: f.payMode,
        p_swap_for: null as unknown as string,
        p_description: f.description,
        p_handover: f.handover,
        p_pickup_point_id: null as unknown as string,
        p_photos: [],
        p_publish: true,
      });
      if (error) throw new Error(`save_listing: ${error.message}`);
      const answer = data as { result: string; listing_id?: string };
      if (answer.result !== "saved" || !answer.listing_id) throw new Error(`save_listing answered ${answer.result}`);
      const id = answer.listing_id;
      undos.push(async () => {
        check(await admin.from("listings").delete().eq("id", id), "Taking the listing away");
      });
      return id;
    },
    async addReport(reporter, { kind, id }) {
      let title: string;
      let owner: string | null;
      if (kind === "request") {
        const request = check(await admin.from("requests").select("title, asker_id").eq("id", id).single(), `No request ${id}`);
        title = request.data!.title;
        owner = request.data!.asker_id;
      } else {
        const listing =
          kind === "listing"
            ? check(await admin.from("listings").select("title, shop_id").eq("id", id).single(), `No listing ${id}`).data!
            : null;
        const shop = check(
          listing
            ? await admin.from("shops").select("name, owner_id").eq("id", listing.shop_id).single()
            : await admin.from("shops").select("name, owner_id").eq("slug", id).single(),
          `No shop for ${kind} ${id}`,
        ).data!;
        title = listing?.title ?? shop.name;
        owner = shop.owner_id;
      }
      const added = check(
        await admin
          .from("reports")
          .insert({
            reporter_id: await this.signedIn(reporter),
            target_kind: kind,
            target_id: id,
            target_title: title,
            reason: "spam",
            target_owner_id: owner,
          })
          .select("id")
          .single(),
        "Reporting",
      );
      const reportId = added.data!.id;
      undos.push(async () => {
        check(await admin.from("reports").delete().eq("id", reportId), "Taking the report away");
      });
      return reportId;
    },
    async saveSearch(name, search, { paused = false, at } = {}) {
      const query = { q: null, category: null, campus: ALL_CAMPUSES, price: null, pay: null, deals: null, ...search };
      const made = (at ?? new Date(Date.now() + (searchesMade += 1))).toISOString();
      const added = check(
        await admin
          .from("saved_searches")
          .insert({
            account_id: await this.signedIn(name),
            q: query.q,
            category: query.category,
            campus_slug: campusToDb(query.campus),
            price: query.price,
            pay: query.pay,
            deals: query.deals,
            search_key: searchKey(query),
            created_at: made,
            paused_at: paused ? made : null,
          })
          .select("id")
          .single(),
        "Saving the search",
      );
      const id = added.data!.id;
      undos.push(async () => {
        check(await admin.from("notifications").delete().eq("kind", "search-match").eq("subject_id", id), "Its alerts");
        check(await admin.from("saved_searches").delete().eq("id", id), "Taking the search away");
      });
      return id;
    },
    async fillFollows(follower, count) {
      const accountId = await this.signedIn(follower);
      const tag = randomUUID().slice(0, 8);
      const shops = check(
        await admin
          .from("shops")
          .insert(
            Array.from({ length: count }, (_, n) => ({
              slug: `contract-fill-${tag}-${n + 1}`,
              name: `Contract fill ${tag} ${n + 1}`,
              tagline: "A shop the contract tests follow.",
              category_slug: "tech",
              campus_slug: "pretoria",
              about: "A shop the contract tests follow and take away again.",
              since: "2026-10",
            })),
          )
          .select("id"),
        "Filling shops",
      );
      const ids = shops.data!.map((row) => row.id);
      undos.push(async () => {
        for (let from = 0; from < ids.length; from += 100) {
          check(await admin.from("shops").delete().in("id", ids.slice(from, from + 100)), "Taking the shops away");
        }
      });
      check(await admin.from("follows").insert(ids.map((shop_id) => ({ account_id: accountId, shop_id }))), "Following");
    },
    async setMentor(slug, mentor) {
      const shop = check(await admin.from("shops").select("owner_id").eq("slug", slug).single(), `No shop ${slug}`);
      const owner = shop.data!.owner_id;
      if (!owner) throw new Error(`No owned shop ${slug}`);
      const before = check(await admin.from("seller_profiles").select("mentor_id").eq("account_id", owner).single(), "Mentor");
      const mentorId = mentor ? await this.signedIn(mentor) : null;
      check(await admin.from("seller_profiles").update({ mentor_id: mentorId }).eq("account_id", owner), "Setting the mentor");
      undos.push(async () => {
        check(
          await admin.from("seller_profiles").update({ mentor_id: before.data!.mentor_id }).eq("account_id", owner),
          "Putting the mentor back",
        );
      });
    },
    async auditCount() {
      const { count, error } = await admin.from("audit_log").select("id", { count: "exact", head: true });
      if (error) throw new Error(error.message);
      return count ?? 0;
    },
    async addOffer(slug, requestId, body) {
      const { name } = await ownerOf(slug);
      const { data, error } = await sessionClient(inject("dbSessions")[name].accessToken).rpc("start_offer", {
        p_request_id: requestId,
        p_listing_id: null as unknown as string,
        p_body: body,
      });
      if (error) throw new Error(`start_offer: ${error.message}`);
      const answer = data as { result: string; conversation_id?: string };
      if (!answer.conversation_id) throw new Error(`start_offer answered ${answer.result}`);
      const id = answer.conversation_id;
      undos.push(async () => {
        check(await admin.from("notifications").delete().eq("subject_id", id), "The offer's notifications");
        check(await admin.from("conversations").delete().eq("id", id), "Taking the offer away");
      });
      return id;
    },
    async offerFromGoneShop(requestId, body) {
      // An account of the test's own (amendment 8: never a world account, whose session is minted once per run).
      const email = `contract-gone-${randomUUID().slice(0, 8)}@vossie.test`;
      const made = await admin.auth.admin.createUser({ email, email_confirm: true });
      if (made.error || !made.data.user) throw new Error(`Making ${email}: ${made.error?.message}`);
      const accountId = made.data.user.id;
      undos.push(async () => {
        const gone = await admin.auth.admin.deleteUser(accountId);
        if (gone.error && gone.error.status !== 404) throw new Error(gone.error.message);
      });
      check(await admin.from("profiles").insert({ id: accountId, first_name: "Gone", campus_slug: "pretoria" }), "Profile");
      const slug = await freeSlug("Contract gone shop");
      const shop = check(
        await admin
          .from("shops")
          .insert({
            slug,
            owner_id: accountId,
            name: "Contract gone shop",
            tagline: "A shop the contract tests open.",
            category_slug: "tech",
            campus_slug: "pretoria",
            about: "A shop the contract tests open and close again.",
            since: "2026-10",
          })
          .select("id")
          .single(),
        "Opening the gone shop",
      );
      check(
        await admin
          .from("seller_profiles")
          .insert({ account_id: accountId, status: "approved", shop_id: shop.data!.id, approved_at: new Date().toISOString() }),
        "Its seller profile",
      );
      const request = check(await admin.from("requests").select("title, asker_id").eq("id", requestId).single(), "Request");
      // The thread as start_offer leaves it: the asker is its buyer, and the shop's first message.
      const thread = check(
        await admin
          .from("conversations")
          .insert({
            shop_id: shop.data!.id,
            buyer_id: request.data!.asker_id,
            status: "offered",
            is_offer: true,
            request_id: requestId,
            request_title: request.data!.title,
          })
          .select("id")
          .single(),
        "Offering",
      );
      const id = thread.data!.id;
      undos.push(async () => {
        check(await admin.from("conversations").delete().eq("id", id), "Taking the offer away");
      });
      check(
        await admin.from("messages").insert([
          { conversation_id: id, side: "seller", body },
          { conversation_id: id, side: "buyer", body: "Message 1" },
        ]),
        "The offer and the asker's answer",
      );
      // Then the seller goes, as deleting their account does.
      check(await admin.rpc("forget_account", { p_account_id: accountId }), "forget_account");
      const deleted = await admin.auth.admin.deleteUser(accountId);
      if (deleted.error) throw new Error(deleted.error.message);
      return id;
    },
    async tidyCommunity() {
      const accounts = WORLD_ACCOUNTS.map((name) => inject("dbSessions")[name].id);
      const rows = async () => {
        const [requests, follows, searches] = await Promise.all([
          admin.from("requests").select("id").in("asker_id", accounts),
          admin.from("follows").select("id").in("account_id", accounts),
          admin.from("saved_searches").select("id").in("account_id", accounts),
        ]);
        for (const result of [requests, follows, searches]) check(result, "Reading the community's rows");
        return {
          requests: requests.data!.map((row) => row.id),
          follows: follows.data!.map((row) => row.id),
          searches: searches.data!.map((row) => row.id),
        };
      };
      const before = await rows();
      undos.push(async () => {
        const after = await rows();
        const made = (now: string[], then: string[]) => now.filter((id) => !then.includes(id));
        const requests = made(after.requests, before.requests);
        const searches = made(after.searches, before.searches);
        const follows = made(after.follows, before.follows);
        if (requests.length > 0) {
          check(await admin.from("notifications").delete().in("subject_id", requests), "The requests' notifications");
          check(await admin.from("requests").delete().in("id", requests), "Taking the requests away");
        }
        if (searches.length > 0) {
          check(await admin.from("notifications").delete().in("subject_id", searches), "The searches' notifications");
          check(await admin.from("saved_searches").delete().in("id", searches), "Taking the searches away");
        }
        if (follows.length > 0) check(await admin.from("follows").delete().in("id", follows), "Taking the follows away");
      });
    },
    async tidyPickupPoints() {
      const before = check(await admin.from("pickup_points").select("id"), "Reading the pickup points");
      const kept = new Set(before.data!.map((row) => row.id));
      undos.push(async () => {
        const after = check(await admin.from("pickup_points").select("id"), "Reading the pickup points");
        const made = after.data!.map((row) => row.id).filter((id) => !kept.has(id));
        if (made.length === 0) return;
        check(await admin.from("shop_pickup_points").delete().in("pickup_point_id", made), "The points' shops");
        check(
          await admin.from("listings").update({ pickup_point_id: null, handover: "on-campus" }).in("pickup_point_id", made),
          "The points' listings",
        );
        check(await admin.from("pickup_points").delete().in("id", made), "Taking the points away");
      });
    },
    async deleteListing(id) {
      const gone = check(await admin.from("listings").delete().eq("id", id).select("id"), "Deleting the listing");
      if (gone.data!.length !== 1) throw new Error(`No listing ${id}`);
    },
    async closeShop(slug) {
      const shop = check(await admin.from("shops").select("id").eq("slug", slug).single(), `No shop ${slug}`).data!;
      const listings = check(await admin.from("listings").select("id").eq("shop_id", shop.id), "Its listings").data!;
      // As forget_account leaves them (amendment 13.1): the shop's reports point at nothing; its pins and listings go.
      check(
        await admin.from("reports").update({ target_gone: true }).eq("target_kind", "seller").eq("target_id", slug),
        "Its reports",
      );
      if (listings.length > 0) {
        check(
          await admin
            .from("reports")
            .update({ target_gone: true })
            .eq("target_kind", "listing")
            .in("target_id", listings.map((row) => row.id)),
          "Its listings' reports",
        );
      }
      check(await admin.from("shops").delete().eq("id", shop.id), "Deleting the shop");
    },
    async cleanup() {
      const pending = undos.reverse();
      undos = [];
      const errors: unknown[] = [];
      for (const undo of pending) {
        try {
          await undo();
        } catch (error) {
          errors.push(error);
        }
      }
      if (errors.length > 0) throw new AggregateError(errors, "The world's cleanup failed: the seed may have changed");
    },
  };
}
