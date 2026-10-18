import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFormState } from "@/lib/auth/form-state";
import { listAudit } from "@/lib/data/audit";
import { listNotes } from "@/lib/data/mentors";
import { resetSampleStore, sampleStore } from "@/lib/data/store";
import { redirectOf, resetRequest, type FakeRequest } from "@/tests/helpers/next-request";
import { form, signedInAs, STAFF_NOW } from "@/tests/helpers/staff";
import { checkInForm, noteForm, STAFF_NOTICE } from "./form-state";
import { addCheckIn, addMentorNote } from "./mentor-actions";

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

describe("mentors' notes and check-ins (staff tools spec 2.6, plan decision 16)", () => {
  it("sends a signed-out visitor to sign in, and gives a student or a shop's other mentor the 404", async () => {
    expect(await redirectOf(() => addMentorNote(form({ shop: "tech-corner", text: "Hi" })))).toBe(
      "/login?next=%2Fmentor%2Ftech-corner",
    );
    await signedInAs(request, "acc-student");
    await expect(addMentorNote(form({ shop: "tech-corner", text: "Hi" }))).rejects.toThrow("notFound");
    sampleStore().accounts.set("acc-zanele", {
      ...sampleStore().accounts.get("acc-mentor")!,
      id: "acc-zanele",
      email: "zanele@eduvos.com",
    });
    await signedInAs(request, "acc-zanele");
    await expect(addMentorNote(form({ shop: "tech-corner", text: "Hi" }))).rejects.toThrow("notFound");
    expect(sampleStore().mentorNotes.size).toBe(2);
  });

  it("adds a note about the shop's owner, logged without its words, and goes back to the notes", async () => {
    await signedInAs(request, "acc-mentor");
    expect(await redirectOf(() => addMentorNote(form({ shop: "tech-corner", text: "Try a plain background." })))).toBe(
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
    expect(await redirectOf(() => addMentorNote(form({ shop: "tech-corner", text: " " })))).toBe(
      "/mentor/tech-corner#mentor-tech-corner-add-note",
    );
    expect((await readFormState(noteForm("tech-corner")))?.errors).toEqual(["mentor-note-missing"]);
    expect(sampleStore().mentorNotes.size).toBe(2);
  });

  it("adds a dated check-in, today or earlier, and an admin may too", async () => {
    await signedInAs(request, "acc-mentor");
    await redirectOf(() => addCheckIn(form({ shop: "tech-corner", day: "2026-10-15", text: "Met." })));
    expect((await readFormState(checkInForm("tech-corner")))?.errors).toEqual(["check-in-day-future"]);
    await signedInAs(request, "acc-admin");
    await redirectOf(() => addCheckIn(form({ shop: "tech-corner", day: "2026-10-14", text: "Called him." })));
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
