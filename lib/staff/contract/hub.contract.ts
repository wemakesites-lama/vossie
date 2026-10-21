import { randomUUID } from "node:crypto";
import { expect, it } from "vitest";
import { readFormState } from "@/lib/auth/form-state";
import { getPostRow, latestBooking, listPostsForStaff } from "@/lib/data/hub-posts";
import { cancelRsvp, rsvpToEvent, sendSlotRequest } from "@/lib/hub-actions";
import { addDays } from "@/lib/looking-for/rules";
import { sastDate } from "@/lib/time";
import type { ActionScenario } from "@/tests/contract/actions";
import { pngBytes } from "@/tests/helpers/image-bytes";
import { answerSlot, savePost } from "../hub-actions";
import { HUB_NOTICE, postForm, STAFF_NOTICE } from "../form-state";
import { slotAnswerText, slotRequestedText } from "../notification-text";
import { issueOnceToken } from "../once";
import { bookSlotPath, editPostPath, HUB_MANAGE_PATH, HUB_NEW_PATH } from "../paths";

// The Hub's actions on both backends (C4/C5 plan Task 18; decisions 3, 6 and 18): a new post is made once however
// many times its form is sent (the action takes the token on the sample store, save_hub_post on Supabase), a made-up
// token is refused with what was typed, a mentor can't touch someone else's post, a slot request tells the author once
// and its answer the student once, an RSVP expires the Hub's pages, and a new cover replaces the old one's file. The
// real Server Actions run as the world's accounts: "staff" (an admin), "asker" (a student, or a mentor where said).
// hub.test.ts runs it on the sample store, hub.db.test.ts on the local stack.

const TIP = {
  post: "",
  kind: "tip",
  title: "Contract tip: price by the hour",
  campus: "all",
  date: "",
  time: "",
  place: "",
  capacity: "",
  summary: "Work out what an hour of your time is worth.",
  body: "## Start with your costs\n- Materials\n- Transport",
  published: "yes",
  intent: "save",
};

/** A week ahead in South Africa: never a start that has passed. */
const ahead = () => addDays(sastDate(new Date()), 7);

export function hubActionsContract(scenario: () => ActionScenario): void {
  const world = () => scenario().world;
  const setUp = async () => {
    await world().tidySelling("hub");
    await world().tidyStaffTools();
    await world().tidyMessaging();
  };
  const notice = async (key = STAFF_NOTICE) => (await scenario().notice(key))?.notice ?? null;
  const postsTitled = async (title: string) =>
    (await world().asViewer("staff", () => listPostsForStaff())).filter((post) => post.title === title);

  /** Staff saves a new post through the editor, with a fresh token; its id. */
  const staffPosts = async (fields: Record<string, string>) => {
    await scenario().signIn("staff");
    const posted = await scenario().post(savePost, { ...TIP, ...fields, once: (await issueOnceToken())! });
    expect(posted.redirect).toBe(HUB_MANAGE_PATH);
    return (await postsTitled(fields.title ?? TIP.title))[0].id;
  };

  it("makes a new post once, however many times its form is sent, with one entry in the log", async () => {
    await setUp();
    await scenario().signIn("staff");
    const once = (await issueOnceToken())!;
    const before = await world().auditCount();
    const first = await scenario().post(savePost, { ...TIP, once });
    expect(first).toMatchObject({ redirect: HUB_MANAGE_PATH, notFound: false });
    expect(await notice()).toBe("post-published");
    expect(scenario().tags()).toEqual(["hub"]);
    await scenario().notice(STAFF_NOTICE);
    const again = await scenario().post(savePost, { ...TIP, once });
    expect(again).toMatchObject({ redirect: HUB_MANAGE_PATH, notFound: false });
    expect(await notice()).toBe("post-published");
    expect(await postsTitled(TIP.title)).toHaveLength(1);
    expect(await world().auditCount()).toBe(before + 1);
    expect(scenario().tags()).toEqual(["hub"]);
  });

  it("refuses a made-up token with the form's words and what was typed, making nothing", async () => {
    await setUp();
    await scenario().signIn("staff");
    const before = await world().auditCount();
    const posted = await scenario().post(savePost, { ...TIP, once: randomUUID() });
    expect(posted.redirect).toBe(HUB_NEW_PATH);
    expect(await readFormState(postForm(null))).toMatchObject({
      errors: ["once-expired"],
      values: expect.objectContaining({ title: TIP.title, summary: TIP.summary, body: TIP.body }),
    });
    expect(await postsTitled(TIP.title)).toEqual([]);
    expect(await world().auditCount()).toBe(before);
    expect(scenario().tags()).toEqual([]);
  });

  it("gives a mentor the 404 on someone else's post, changing nothing", async () => {
    await setUp();
    const id = await staffPosts({ title: "Contract staff's own tip" });
    const before = { post: await world().asViewer("staff", () => getPostRow(id)), audit: await world().auditCount() };
    await world().setRoles("asker", ["mentor"]);
    await scenario().signIn("asker");
    const posted = await scenario().post(savePost, { ...TIP, post: id, title: "A mentor's change" });
    expect(posted).toEqual({ redirect: null, type: undefined, notFound: true });
    expect({ post: await world().asViewer("staff", () => getPostRow(id)), audit: await world().auditCount() }).toEqual(before);
  });

  it("tells the author of a slot request once, and the student of its answer once", async () => {
    await setUp();
    const title = "Contract office hours: pricing";
    const post = await staffPosts({ kind: "office-hours", title, campus: "pretoria", date: ahead(), time: "10:00", place: "The Hub" });
    const staffNotes = (await world().notificationsOf("staff")).length;

    await scenario().signIn("asker");
    const asked = await scenario().post(sendSlotRequest, { post, help: "How to price a braid.", time: "After 13:00" });
    expect(asked.redirect).toBe(bookSlotPath(post));
    expect(await notice(HUB_NOTICE)).toBe("slot-requested");
    expect((await scenario().post(sendSlotRequest, { post, help: "Again.", time: "" })).redirect).toBe(bookSlotPath(post));
    expect((await world().notificationsOf("staff")).slice(staffNotes)).toEqual([
      expect.objectContaining({ kind: "booking", text: slotRequestedText("Asker", title), href: `${HUB_MANAGE_PATH}#hub-queue` }),
    ]);

    const booking = (await world().asViewer("asker", (id) => latestBooking(post, id)))!;
    await scenario().signIn("staff");
    const before = await world().auditCount();
    expect((await scenario().post(answerSlot, { booking: booking.id, answer: "accepted" })).redirect).toBe(`${HUB_MANAGE_PATH}#hub-queue`);
    expect(await notice()).toBe("booking-accepted");
    expect((await scenario().post(answerSlot, { booking: booking.id, answer: "declined" })).redirect).toBe(`${HUB_MANAGE_PATH}#hub-queue`);
    expect(await notice()).toBe("nothing");
    expect(await world().auditCount()).toBe(before + 1);
    const told = (await world().notificationsOf("asker")).filter((note) => note.kind === "booking");
    expect(told).toEqual([{ kind: "booking", subjectId: booking.id, text: slotAnswerText("accepted", title), href: bookSlotPath(post) }]);
  });

  it("expires the Hub's pages on an RSVP and its cancelling, and not on a second RSVP", async () => {
    await setUp();
    const post = await staffPosts({ kind: "event", title: "Contract market day", campus: "pretoria", date: ahead(), time: "10:00", place: "The Hub", capacity: "20" });
    await scenario().signIn("asker");
    const tagsBefore = scenario().tags().length;
    expect((await scenario().post(rsvpToEvent, { post })).redirect).toBe(`/hub/${post}`);
    expect(await notice(HUB_NOTICE)).toBe("rsvp");
    expect(scenario().tags().slice(tagsBefore)).toEqual(["hub"]);
    await scenario().post(rsvpToEvent, { post });
    expect(scenario().tags().slice(tagsBefore)).toEqual(["hub"]);
    await scenario().post(cancelRsvp, { post });
    expect(await notice(HUB_NOTICE)).toBe("rsvp-cancelled");
    expect(scenario().tags().slice(tagsBefore)).toEqual(["hub", "hub"]);
  });

  it("keeps a cover stored on Preview for the save, and a new cover replaces the old one's file", async () => {
    await setUp();
    await scenario().signIn("staff");
    const cover = (name: string) => new File([pngBytes()], name, { type: "image/png" });
    const preview = async (fields: Record<string, string | File>, id: string | null) => {
      await scenario().post(savePost, { ...TIP, ...fields, intent: "preview" });
      return (await readFormState(postForm(id)))!.values.cover;
    };
    const first = await preview({ cover: cover("first.png") }, null);
    expect(first).toMatch(/^\/photos\//);
    expect((await scenario().post(savePost, { ...TIP, keepCover: first, once: (await issueOnceToken())! })).redirect).toBe(HUB_MANAGE_PATH);
    const id = (await postsTitled(TIP.title))[0].id;
    expect((await world().asViewer("staff", () => getPostRow(id)))?.image).toEqual({ src: first, alt: "" });
    expect(await world().photoStored(first)).toBe(true);

    const second = await preview({ post: id, cover: cover("second.png") }, id);
    expect(second).toMatch(/^\/photos\//);
    expect((await scenario().post(savePost, { ...TIP, post: id, keepCover: second })).redirect).toBe(HUB_MANAGE_PATH);
    expect((await world().asViewer("staff", () => getPostRow(id)))?.image).toEqual({ src: second, alt: "" });
    expect(await world().photoStored(second)).toBe(true);
    expect(await world().photoStored(first)).toBe(false);
    expect(editPostPath(id)).toBe(`/hub/${id}/edit`);
  });
}
