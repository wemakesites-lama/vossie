import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFormState, writeFormState } from "@/lib/auth/form-state";
import { resetSampleStore } from "@/lib/data/store";
import { resetRequest, type FakeRequest } from "@/tests/helpers/next-request";
import { signedInAs, STAFF_NOW } from "@/tests/helpers/staff";
import { clearStaffForm, declineForm, HUB_NOTICE, leaveNotice, postForm, postPrefix, takeNotice } from "./form-state";

const request = vi.hoisted((): FakeRequest => ({ cookies: new Map(), sent: new Map(), proto: "http" }));

vi.mock("next/headers", async () => (await import("@/tests/helpers/next-request")).nextHeaders(request));
vi.mock("next/navigation", async () => (await import("@/tests/helpers/next-request")).nextNavigation());
vi.mock("next/server", async () => (await import("@/tests/helpers/next-request")).nextServer());

beforeEach(async () => {
  resetSampleStore();
  resetRequest(request);
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(STAFF_NOW);
  await signedInAs(request, "acc-admin");
});

describe("the notice after a staff action (staff tools spec 4)", () => {
  it("is shown once, by the page the action lands on", async () => {
    await leaveNotice("approved", STAFF_NOW);
    expect(await takeNotice()).toBe("approved");
    expect(await takeNotice()).toBeNull();
  });

  it("keeps a student's Hub notice apart from staff's", async () => {
    await leaveNotice("rsvp", STAFF_NOW, HUB_NOTICE);
    expect(await takeNotice()).toBeNull();
    expect(await takeNotice(HUB_NOTICE)).toBe("rsvp");
  });
});

describe("the staff forms' state (accounts plan decision 3)", () => {
  it("keeps one form's state per thing, and clears it", async () => {
    await writeFormState(declineForm("crochet-corner"), { errors: ["reason-missing"], values: {}, notice: null }, STAFF_NOW);
    expect(await readFormState(declineForm("tech-corner"))).toBeNull();
    await clearStaffForm(declineForm("crochet-corner"));
    expect(await readFormState(declineForm("crochet-corner"))).toBeNull();
  });
});

describe("the post editor's names", () => {
  it("names a new post's form and ids apart from an edit's, and each edit's apart from the others", () => {
    expect([postForm(null), postForm("h-002")]).toEqual(["post:new", "post:h-002"]);
    expect([postPrefix(null), postPrefix("h-002")]).toEqual(["new-post", "edit-h-002"]);
  });
});
