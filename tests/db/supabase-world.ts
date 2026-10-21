import { inject } from "vitest";
import type { World } from "@/tests/contract/world";
import { testAdminClient, type DbClient } from "./accounts";
import { setViewer } from "./viewer";

// The local stack's world (2b plan decision 18, Task 13). Its accounts are the global setup's (tests/db/global-setup.ts).
// Its verbs write with the admin client, never through a function a test is checking, and each records an undo with
// undoLater(), which cleanup() runs newest first after each test, so the seed is the same after every test.

export type SupabaseWorld = World & {
  /** The secret key's client, for verbs and for checking what a function wrote. */
  readonly admin: DbClient;
  /** Records how to undo a write; cleanup() runs the undos newest first. */
  undoLater(undo: () => Promise<void>): void;
};

/** A Supabase world. Made before each test. */
export function supabaseWorld(): SupabaseWorld {
  const admin = testAdminClient();
  let undos: (() => Promise<void>)[] = [];
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
