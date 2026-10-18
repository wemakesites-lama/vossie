import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFormState } from "@/lib/auth/form-state";
import { listAudit } from "@/lib/data/audit";
import { listNotes } from "@/lib/data/mentors";
import { resetSampleStore, sampleStore } from "@/lib/data/store";
import { redirectOf, resetRequest, type FakeRequest } from "@/tests/helpers/next-request";
import { form, signedInAs, STAFF_NOW } from "@/tests/helpers/staff";
import { checkInForm, clearStaffForm, noteForm, STAFF_NOTICE } from "./form-state";
import { addCheckIn, addMentorNote } from "./mentor-actions";
import { issueOnceToken, ONCE_TTL_MS } from "./once";

const request = vi.hoisted((): FakeRequest => ({ cookies: new Map(), sent: new Map(), proto: "http" }));

vi.mock("next/headers", async () => (await import("@/tests/helpers/next-request")).nextHeaders(request));
vi.mock("next/navigation", async () => (await import("@/tests/helpers/next-request")).nextNavigation());
vi.mock("next/server", async () => (await import("@/tests/helpers/next-request")).nextServer());
vi.mock("next/cache", async () => (await import("@/tests/helpers/next-request")).nextCache(request));

beforeEach(() => {
  resetSampleStore();
  resetRequest(request);
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(STAFF_NOW);
});

/**
 * A note's or check-in's form as the browser posts it: with the one-time token the page drew when it showed the form
 * (amendment 15.7). Signed out there is no token to draw.
 */
async function fresh(fields: Record<string, string>): Promise<FormData> {
  return form({ ...fields, once: (await issueOnceToken()) ?? "" });
}

describe("mentors' notes and check-ins (staff tools spec 2.6, plan decision 16)", () => {
  it("sends a signed-out visitor to sign in, and gives a student or a shop's other mentor the 404", async () => {
    expect(await redirectOf(async () => addMentorNote(await fresh({ shop: "tech-corner", text: "Hi" })))).toBe(
      "/login?next=%2Fmentor%2Ftech-corner",
    );
    await signedInAs(request, "acc-student");
    await expect(addMentorNote(await fresh({ shop: "tech-corner", text: "Hi" }))).rejects.toThrow("notFound");
    sampleStore().accounts.set("acc-zanele", {
      ...sampleStore().accounts.get("acc-mentor")!,
      id: "acc-zanele",
      email: "zanele@eduvos.com",
    });
    await signedInAs(request, "acc-zanele");
    await expect(addMentorNote(await fresh({ shop: "tech-corner", text: "Hi" }))).rejects.toThrow("notFound");
    expect(sampleStore().mentorNotes.size).toBe(2);
  });

  it("adds a note about the shop's owner, logged without its words, and goes back to the notes", async () => {
    await signedInAs(request, "acc-mentor");
    expect(await redirectOf(async () => addMentorNote(await fresh({ shop: "tech-corner", text: "Try a plain background." })))).toBe(
      "/mentor/tech-corner#mentor-tech-corner-notes",
    );
    expect((await listNotes("acc-seller"))[0]).toMatchObject({
      kind: "note",
      text: "Try a plain background.",
      authorName: "Naledi",
    });
    expect((await listAudit({ staff: null, kind: null }))[0]).toMatchObject({
      action: "note-added",
      targetName: "Tech corner",
      detail: "",
    });
    expect((await readFormState(STAFF_NOTICE))?.notice).toBe("note-added");
  });

  it("keeps what was typed and says what's wrong", async () => {
    await signedInAs(request, "acc-mentor");
    expect(await redirectOf(async () => addMentorNote(await fresh({ shop: "tech-corner", text: " " })))).toBe(
      "/mentor/tech-corner#mentor-tech-corner-add-note",
    );
    expect((await readFormState(noteForm("tech-corner")))?.errors).toEqual(["mentor-note-missing"]);
    expect(sampleStore().mentorNotes.size).toBe(2);
  });

  it("adds a dated check-in, today or earlier, and an admin may too", async () => {
    await signedInAs(request, "acc-mentor");
    await redirectOf(async () => addCheckIn(await fresh({ shop: "tech-corner", day: "2026-10-15", text: "Met." })));
    expect((await readFormState(checkInForm("tech-corner")))?.errors).toEqual(["check-in-day-future"]);
    await signedInAs(request, "acc-admin");
    await redirectOf(async () => addCheckIn(await fresh({ shop: "tech-corner", day: "2026-10-14", text: "Called him." })));
    expect((await listNotes("acc-seller"))[0]).toMatchObject({
      kind: "check-in",
      checkInOn: "2026-10-14",
      authorName: "Pieter",
    });
    expect((await listAudit({ staff: null, kind: "mentoring" }))[0]).toMatchObject({
      action: "check-in-added",
      detail: "2026-10-14",
    });
  });
});

describe("nobody writes about their own shop (staff tools amendment 15.3)", () => {
  it("gives the 404 to a mentor or an admin who owns the shop, whoever its mentor is", async () => {
    sampleStore().accounts.get("acc-seller")!.roles.push("mentor");
    sampleStore().sellerProfiles.get("acc-seller")!.mentorId = "acc-seller";
    await signedInAs(request, "acc-seller");
    await expect(addMentorNote(await fresh({ shop: "tech-corner", text: "Notes on myself." }))).rejects.toThrow("notFound");
    await expect(
      addCheckIn(await fresh({ shop: "tech-corner", day: "2026-10-14", text: "Met myself." })),
    ).rejects.toThrow("notFound");
    sampleStore().accounts.get("acc-seller")!.roles.push("admin");
    await expect(addMentorNote(await fresh({ shop: "tech-corner", text: "Still me." }))).rejects.toThrow("notFound");
    expect(sampleStore().mentorNotes.size).toBe(2);
    expect(await listAudit({ staff: null, kind: null })).toEqual([]);
  });
});

describe("a note or check-in is made once (staff tools amendment 15.7)", () => {
  const FORGED = "00000000-0000-4000-8000-000000000000";
  const NOTE = { shop: "tech-corner", text: "Try a plain background." };
  const CHECK_IN = { shop: "tech-corner", day: "2026-10-14", text: "Called him." };

  it("makes one note however many times the form is sent, and the repeat goes to the notes with the same notice", async () => {
    await signedInAs(request, "acc-mentor");
    const once = (await issueOnceToken())!;
    const send = () => redirectOf(() => addMentorNote(form({ ...NOTE, once })));
    expect(await send()).toBe("/mentor/tech-corner#mentor-tech-corner-notes");
    await clearStaffForm(STAFF_NOTICE);
    expect(await send()).toBe("/mentor/tech-corner#mentor-tech-corner-notes");
    expect((await readFormState(STAFF_NOTICE))?.notice).toBe("note-added");
    expect(sampleStore().mentorNotes.size).toBe(3);
    expect(await listAudit({ staff: null, kind: null })).toHaveLength(1);
  });

  it("makes one check-in however many times the form is sent", async () => {
    await signedInAs(request, "acc-mentor");
    const once = (await issueOnceToken())!;
    const send = () => redirectOf(() => addCheckIn(form({ ...CHECK_IN, once })));
    await send();
    await clearStaffForm(STAFF_NOTICE);
    await send();
    expect((await readFormState(STAFF_NOTICE))?.notice).toBe("check-in-added");
    expect(sampleStore().mentorNotes.size).toBe(3);
    expect(await listAudit({ staff: null, kind: null })).toHaveLength(1);
  });

  it("makes one when two sends arrive together", async () => {
    await signedInAs(request, "acc-mentor");
    const note = (await issueOnceToken())!;
    const checkIn = (await issueOnceToken())!;
    const results = await Promise.allSettled([
      redirectOf(() => addMentorNote(form({ ...NOTE, once: note }))),
      redirectOf(() => addMentorNote(form({ ...NOTE, once: note }))),
      redirectOf(() => addCheckIn(form({ ...CHECK_IN, once: checkIn }))),
      redirectOf(() => addCheckIn(form({ ...CHECK_IN, once: checkIn }))),
    ]);
    expect(results.every((result) => result.status === "fulfilled")).toBe(true);
    expect(sampleStore().mentorNotes.size).toBe(4);
    expect(await listAudit({ staff: null, kind: null })).toHaveLength(2);
  });

  it("keeps a note and a check-in apart: each has its own token", async () => {
    await signedInAs(request, "acc-mentor");
    await redirectOf(async () => addMentorNote(await fresh(NOTE)));
    await redirectOf(async () => addCheckIn(await fresh(CHECK_IN)));
    expect(sampleStore().mentorNotes.size).toBe(4);
  });

  it("refuses a form with no token, a made-up one or one that has run out, keeping what was typed and saving nothing", async () => {
    await signedInAs(request, "acc-mentor");
    const old = (await issueOnceToken())!;
    vi.setSystemTime(new Date(STAFF_NOW.getTime() + ONCE_TTL_MS));
    for (const once of ["", FORGED, "x".repeat(100_000), old]) {
      expect(await redirectOf(() => addMentorNote(form({ ...NOTE, once }))), once.slice(0, 12)).toBe(
        "/mentor/tech-corner#mentor-tech-corner-add-note",
      );
      expect(await readFormState(noteForm("tech-corner"))).toMatchObject({
        errors: ["once-expired"],
        values: { text: NOTE.text },
      });
      expect(await redirectOf(() => addCheckIn(form({ ...CHECK_IN, once })))).toBe(
        "/mentor/tech-corner#mentor-tech-corner-add-check-in",
      );
      expect(await readFormState(checkInForm("tech-corner"))).toMatchObject({
        errors: ["once-expired"],
        values: { day: CHECK_IN.day, text: CHECK_IN.text },
      });
    }
    expect(sampleStore().mentorNotes.size).toBe(2);
    expect(await listAudit({ staff: null, kind: null })).toEqual([]);
  });

  it("leaves the token for another try when the words fail their checks", async () => {
    await signedInAs(request, "acc-mentor");
    const once = (await issueOnceToken())!;
    await redirectOf(() => addMentorNote(form({ ...NOTE, text: " ", once })));
    expect((await readFormState(noteForm("tech-corner")))?.errors).toEqual(["mentor-note-missing"]);
    await redirectOf(() => addMentorNote(form({ ...NOTE, once })));
    expect(sampleStore().mentorNotes.size).toBe(3);
  });
});

