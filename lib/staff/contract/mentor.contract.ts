import { randomUUID } from "node:crypto";
import { expect, it } from "vitest";
import { readFormState } from "@/lib/auth/form-state";
import { listNotes } from "@/lib/data/mentors";
import { addDays } from "@/lib/looking-for/rules";
import { sastDate } from "@/lib/time";
import type { ActionScenario } from "@/tests/contract/actions";
import { checkInForm, noteForm, STAFF_NOTICE } from "../form-state";
import { addCheckIn, addMentorNote } from "../mentor-actions";
import { issueOnceToken } from "../once";
import { mentorShopPath } from "../paths";

// Mentors' notes and check-ins on both backends (C4/C5 plan Task 19; decisions 3 and 6): a note is made once however
// many times its form is sent, with one audit entry (the action takes the token on the sample store, add_mentor_note
// on Supabase); a check-in day still to come is the form's error; a mentor of another shop gets the 404; a made-up
// token is refused with what was typed. "asker" mentors "shopper"'s shop; "seller" mentors none. mentor.test.ts runs
// it on the sample store, mentor.db.test.ts on the local stack.

export function mentorActionsContract(scenario: () => ActionScenario): void {
  const world = () => scenario().world;
  /** "shopper"'s shop, mentored by "asker"; its link and the owner's id. */
  const setUp = async () => {
    await world().tidyStaffTools();
    await world().tidyMessaging();
    await world().setRoles("asker", ["mentor"]);
    const slug = await world().openShop("shopper");
    await world().setMentor(slug, "asker");
    return { slug, ownerId: await world().signedIn("shopper"), notes: `${mentorShopPath(slug)}#mentor-${slug}-notes` };
  };
  const notesAbout = (ownerId: string) => world().asViewer("staff", () => listNotes(ownerId));

  it("adds a note once, however many times its form is sent, with one entry in the log", async () => {
    const { slug, ownerId, notes } = await setUp();
    await scenario().signIn("asker");
    const once = (await issueOnceToken())!;
    const before = await world().auditCount();
    const fields = { shop: slug, text: "Replies fast. Next: photos on a plain background.", once };
    expect((await scenario().post(addMentorNote, fields)).redirect).toBe(notes);
    expect((await scenario().notice(STAFF_NOTICE))?.notice).toBe("note-added");
    expect((await scenario().post(addMentorNote, fields)).redirect).toBe(notes);
    expect(await notesAbout(ownerId)).toMatchObject([{ kind: "note", text: fields.text, authorName: "Asker" }]);
    expect(await world().auditCount()).toBe(before + 1);
    expect(scenario().tags()).toEqual([]);
  });

  it("keeps a check-in day still to come as the form's error, adding nothing", async () => {
    const { slug, ownerId } = await setUp();
    await scenario().signIn("asker");
    const before = await world().auditCount();
    const day = addDays(sastDate(new Date()), 1);
    const posted = await scenario().post(addCheckIn, { shop: slug, day, text: "We'll meet tomorrow.", once: (await issueOnceToken())! });
    expect(posted.redirect).toBe(`${mentorShopPath(slug)}#mentor-${slug}-add-check-in`);
    expect(await readFormState(checkInForm(slug))).toMatchObject({ errors: ["check-in-day-future"], values: { day, text: "We'll meet tomorrow." } });
    expect(await notesAbout(ownerId)).toEqual([]);
    expect(await world().auditCount()).toBe(before);
    // Today's goes in.
    const today = sastDate(new Date());
    await scenario().post(addCheckIn, { shop: slug, day: today, text: "Met at the Hub today.", once: (await issueOnceToken())! });
    expect(await notesAbout(ownerId)).toMatchObject([{ kind: "check-in", checkInOn: today, text: "Met at the Hub today." }]);
  });

  it("gives a mentor of another shop the 404, writing nothing", async () => {
    const { slug, ownerId } = await setUp();
    await world().setRoles("seller", ["mentor"]);
    await scenario().signIn("seller");
    const before = await world().auditCount();
    const posted = await scenario().post(addMentorNote, { shop: slug, text: "Not my shop.", once: (await issueOnceToken())! });
    expect(posted).toEqual({ redirect: null, type: undefined, notFound: true });
    expect(await notesAbout(ownerId)).toEqual([]);
    expect(await world().auditCount()).toBe(before);
  });

  it("refuses a made-up token with the form's words and what was typed, adding nothing", async () => {
    const { slug, ownerId } = await setUp();
    await scenario().signIn("asker");
    const before = await world().auditCount();
    const posted = await scenario().post(addMentorNote, { shop: slug, text: "A note with a forged token.", once: randomUUID() });
    expect(posted.redirect).toBe(`${mentorShopPath(slug)}#mentor-${slug}-add-note`);
    expect(await readFormState(noteForm(slug))).toMatchObject({ errors: ["once-expired"], values: { text: "A note with a forged token." } });
    expect(await notesAbout(ownerId)).toEqual([]);
    expect(await world().auditCount()).toBe(before);
  });
}
