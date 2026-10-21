import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, expect, it } from "vitest";
import { addRsvp, requestSlot, saveHubPost } from "@/lib/data/hub-posts";
import { exportStaffToolsData, forgetAccountInStaffTools } from "@/lib/data/staff-privacy";
import { addDays } from "@/lib/looking-for/rules";
import type { PostFields } from "@/lib/staff/post-rules";
import { sastDate } from "@/lib/time";
import type { World } from "@/tests/contract/world";

// The staff tools' part of the data download in both backends (C4/C5 plan Task 21; decision 16): the account's own
// RSVPs and slot requests, named by their posts, with no ids and never a mentor's notes. Deletion is forget_account's on
// Supabase. staff-privacy.test.ts runs it on the sample store, staff-privacy.db.test.ts on the local stack.

const AHEAD = () => `${addDays(sastDate(new Date()), 7)}T08:00:00.000Z`;

const POST: PostFields = {
  kind: "event",
  title: "Contract market day",
  campusSlug: "pretoria",
  startsAt: null,
  place: "The Hub",
  capacity: 20,
  summary: "A post the contract tests make and take away again.",
  body: "A post the contract tests make and take away again.",
  published: true,
};

export function staffPrivacyContract(makeWorld: () => World): void {
  let world: World;
  beforeEach(async () => {
    world = makeWorld();
    await world.tidyStaffTools();
    await world.tidyMessaging();
  });
  afterEach(async () => {
    await world.cleanup();
  });

  /** A published post by "staff", made through saveHubPost with a fresh token; its id. */
  const post = async (fields: Partial<PostFields>) => {
    const once = randomUUID();
    await world.onceRow("staff", `staff-once:${once}`);
    const saved = await world.asViewer("staff", (id) =>
      saveHubPost({ id: null, fields: { ...POST, startsAt: AHEAD(), ...fields }, cover: null, authorId: id, now: new Date(), onceToken: once }),
    );
    return saved!.row.id;
  };

  it("downloads the account's RSVPs and slot requests by their posts' names, with no ids and no notes", async () => {
    const event = await post({});
    const hours = await post({ kind: "office-hours", title: "Contract office hours", capacity: null });
    const now = new Date();
    await world.asViewer("asker", (id) => addRsvp(event, id, sastDate(now), now));
    await world.asViewer("asker", (id) =>
      requestSlot({ postId: hours, accountId: id, help: "How to price a braid.", time: "After 13:00", today: sastDate(now), now }),
    );
    const download = await world.asViewer("asker", (id) => exportStaffToolsData(id));
    expect(Object.keys(download)).toEqual(["hubRsvps", "slotRequests"]);
    expect(download).toEqual({
      hubRsvps: [{ event: "Contract market day", at: expect.any(String) }],
      slotRequests: [{ officeHours: "Contract office hours", help: "How to price a braid.", time: "After 13:00", status: "open", at: expect.any(String) }],
    });
    expect(Object.keys(download.hubRsvps[0])).toEqual(["event", "at"]);
    expect(Object.keys(download.slotRequests[0])).toEqual(["officeHours", "help", "time", "status", "at"]);
    expect(JSON.stringify(download)).not.toContain(event);
    expect(JSON.stringify(download)).not.toContain(await world.signedIn("asker"));
    expect(await world.asViewer("shopper", (id) => exportStaffToolsData(id))).toEqual({ hubRsvps: [], slotRequests: [] });
  });

  it("on Supabase leaves deleting to forget_account", async () => {
    if (world.name !== "supabase") return;
    await expect(world.asViewer("asker", (id) => forgetAccountInStaffTools(id))).rejects.toThrow("forget_account does this");
  });
}
