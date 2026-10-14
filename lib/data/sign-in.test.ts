import { beforeEach, describe, expect, it } from "vitest";
import { makeSignInAttempt } from "@/tests/helpers/fakes";
import {
  countCodesSent,
  deleteSignInAttempt,
  getSampleEmail,
  getSignInAttempt,
  recordCodeSent,
  saveSampleEmail,
  saveSignInAttempt,
} from "./sign-in";
import { resetSampleStore, sampleStore } from "./store";

const NOW = new Date("2026-10-14T08:42:00.000Z");

beforeEach(() => {
  resetSampleStore();
});

describe("sign-in attempts (accounts spec 2.2)", () => {
  it("saves and finds an attempt, handing out a copy", async () => {
    await saveSignInAttempt(makeSignInAttempt({ key: "a1", email: "thandi@eduvos.com" }), NOW);
    const found = await getSignInAttempt("a1", NOW);
    expect(found?.email).toBe("thandi@eduvos.com");
    found!.errors.push("locked");
    expect((await getSignInAttempt("a1", NOW))?.errors).toEqual([]);
  });

  it("forgets an attempt once it has run out, and tidies it away with its sample email on the next save", async () => {
    const early = new Date("2026-10-14T08:00:00.000Z");
    await saveSignInAttempt(makeSignInAttempt({ key: "old", expiresAt: "2026-10-14T08:30:00.000Z" }), early);
    await saveSampleEmail({ attemptKey: "old", to: "t@eduvos.com", code: "123456", sentAt: early.toISOString() });
    expect(await getSignInAttempt("old", new Date("2026-10-14T08:29:59.000Z"))).not.toBeNull();
    expect(await getSignInAttempt("old", new Date("2026-10-14T08:30:00.000Z"))).toBeNull();
    await saveSignInAttempt(makeSignInAttempt({ key: "new" }), NOW);
    expect(sampleStore().signInAttempts.has("old")).toBe(false);
    expect(await getSampleEmail("old")).toBeNull();
  });

  it("ends an attempt, and its sample email goes with it", async () => {
    await saveSignInAttempt(makeSignInAttempt({ key: "a1" }), NOW);
    await saveSampleEmail({ attemptKey: "a1", to: "t@eduvos.com", code: "123456", sentAt: NOW.toISOString() });
    await deleteSignInAttempt("a1");
    expect(await getSignInAttempt("a1", NOW)).toBeNull();
    expect(await getSampleEmail("a1")).toBeNull();
  });
});

describe("the code count (accounts spec 5)", () => {
  it("counts the codes sent to an email in the last hour", async () => {
    await recordCodeSent("t@eduvos.com", new Date("2026-10-14T07:40:00.000Z"));
    await recordCodeSent("t@eduvos.com", new Date("2026-10-14T08:00:00.000Z"));
    await recordCodeSent("t@eduvos.com", new Date("2026-10-14T08:30:00.000Z"));
    await recordCodeSent("other@eduvos.com", NOW);
    // 07:40 is more than an hour before 08:42.
    expect(await countCodesSent("t@eduvos.com", NOW)).toBe(2);
    expect(await countCodesSent("nobody@eduvos.com", NOW)).toBe(0);
  });

  it("forgets sends older than an hour as it records a new one", async () => {
    await recordCodeSent("t@eduvos.com", new Date("2026-10-14T06:00:00.000Z"));
    await recordCodeSent("t@eduvos.com", NOW);
    expect(sampleStore().codeSends.get("t@eduvos.com")).toEqual([NOW.toISOString()]);
  });
});

describe("sample mode's outbox (accounts spec 2.3, plan decision 5)", () => {
  it("keeps the last code sent for each attempt", async () => {
    await saveSampleEmail({ attemptKey: "a1", to: "t@eduvos.com", code: "111111", sentAt: NOW.toISOString() });
    await saveSampleEmail({ attemptKey: "a1", to: "t@eduvos.com", code: "222222", sentAt: NOW.toISOString() });
    expect((await getSampleEmail("a1"))?.code).toBe("222222");
    expect(await getSampleEmail("a2")).toBeNull();
  });
});
