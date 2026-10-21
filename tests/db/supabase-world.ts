import { inject } from "vitest";
import { campusToDb } from "@/lib/data/supabase/rows";
import { saleNoteText } from "@/lib/messaging/notification-text";
import { threadPath } from "@/lib/messaging/paths";
import { SLUG_MAX, slugify } from "@/lib/selling/rules";
import { sastDate } from "@/lib/time";
import { WORLD_ACCOUNTS, type World, type WorldAccountName } from "@/tests/contract/world";
import { testAdminClient, type DbClient } from "./accounts";
import { sql } from "./sql";
import { setViewer } from "./viewer";

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
  /** Every file in the bucket under `folder` (an account's id, or "hub"), as paths. */
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
      setViewer(name);
      try {
        return await read(await this.signedIn(name));
      } finally {
        setViewer(null);
      }
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
      const folder = accountId ?? "hub";
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
        const named = new Set(after.data.filter((row) => kept.has(row.id)).map((row) => row.path));
        await removeFiles((await filesUnder(folder)).filter((path) => !named.has(path)));
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
