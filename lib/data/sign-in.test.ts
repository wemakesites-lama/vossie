import { beforeEach, describe, expect, it } from "vitest";
import { makeSignInAttempt } from "@/tests/helpers/fakes";
import {
  countCodesSent,
  deleteSignInAttempt,
  getSampleEmail,
  getSignInAttempt,
  recordCodeSent,
  recordWrongTry,
  reserveCodeSend,
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

  it("forgets every email's old sends as it records one, so an email nobody tries again doesn't stay for ever", async () => {
    await recordCodeSent("gone@eduvos.com", new Date("2026-10-14T06:00:00.000Z"));
    await recordCodeSent("kept@eduvos.com", new Date("2026-10-14T08:30:00.000Z"));
    await recordCodeSent("mixed@eduvos.com", new Date("2026-10-14T06:30:00.000Z"));
    await recordCodeSent("mixed@eduvos.com", new Date("2026-10-14T08:20:00.000Z"));
    await recordCodeSent("other@eduvos.com", NOW);
    const { codeSends } = sampleStore();
    expect(codeSends.has("gone@eduvos.com")).toBe(false);
    expect(codeSends.get("kept@eduvos.com")).toEqual(["2026-10-14T08:30:00.000Z"]);
    expect(codeSends.get("mixed@eduvos.com")).toEqual(["2026-10-14T08:20:00.000Z"]);
    expect(codeSends.get("other@eduvos.com")).toEqual([NOW.toISOString()]);
  });
});

describe("reserving a code send (accounts spec 5)", () => {
  it("records the send and says yes while the hour's count is under the limit", async () => {
    expect(await reserveCodeSend("t@eduvos.com", NOW, 2)).toBe(true);
    expect(await reserveCodeSend("t@eduvos.com", NOW, 2)).toBe(true);
    expect(await countCodesSent("t@eduvos.com", NOW)).toBe(2);
  });

  it("says no at the limit, and records nothing", async () => {
    await reserveCodeSend("t@eduvos.com", NOW, 2);
    await reserveCodeSend("t@eduvos.com", NOW, 2);
    expect(await reserveCodeSend("t@eduvos.com", NOW, 2)).toBe(false);
    expect(sampleStore().codeSends.get("t@eduvos.com")).toHaveLength(2);
  });

  it("counts only the last hour, so an old send frees its place", async () => {
    await recordCodeSent("t@eduvos.com", new Date("2026-10-14T07:40:00.000Z"));
    await recordCodeSent("t@eduvos.com", new Date("2026-10-14T08:30:00.000Z"));
    // 07:40 is more than an hour before 08:42, so only one send counts.
    expect(await reserveCodeSend("t@eduvos.com", NOW, 2)).toBe(true);
    expect(await reserveCodeSend("t@eduvos.com", NOW, 2)).toBe(false);
  });

  it("keeps each email's count apart", async () => {
    await reserveCodeSend("a@eduvos.com", NOW, 1);
    expect(await reserveCodeSend("a@eduvos.com", NOW, 1)).toBe(false);
    expect(await reserveCodeSend("b@eduvos.com", NOW, 1)).toBe(true);
  });

  it("lets exactly the limit through when requests overlap", async () => {
    const results = await Promise.all(Array.from({ length: 20 }, () => reserveCodeSend("t@eduvos.com", NOW, 5)));
    expect(results.filter(Boolean)).toHaveLength(5);
    expect(sampleStore().codeSends.get("t@eduvos.com")).toHaveLength(5);
  });

  it("forgets every email's old sends when it records one, as recordCodeSent does", async () => {
    await recordCodeSent("gone@eduvos.com", new Date("2026-10-14T06:00:00.000Z"));
    await reserveCodeSend("t@eduvos.com", NOW, 5);
    expect(sampleStore().codeSends.has("gone@eduvos.com")).toBe(false);
  });
});

describe("counting a wrong try (accounts spec 2.2)", () => {
  it("adds one to the attempt's count and gives the new count", async () => {
    await saveSignInAttempt(makeSignInAttempt({ key: "a1", wrongTries: 1 }), NOW);
    expect(await recordWrongTry("a1")).toBe(2);
    expect(await recordWrongTry("a1")).toBe(3);
    expect((await getSignInAttempt("a1", NOW))?.wrongTries).toBe(3);
  });

  it("touches only that attempt", async () => {
    await saveSignInAttempt(makeSignInAttempt({ key: "a1" }), NOW);
    await saveSignInAttempt(makeSignInAttempt({ key: "a2", wrongTries: 3 }), NOW);
    await recordWrongTry("a1");
    expect((await getSignInAttempt("a2", NOW))?.wrongTries).toBe(3);
  });

  it("loses no try when requests overlap: every caller gets its own count", async () => {
    await saveSignInAttempt(makeSignInAttempt({ key: "a1" }), NOW);
    const counts = await Promise.all(Array.from({ length: 5 }, () => recordWrongTry("a1")));
    expect([...counts].sort()).toEqual([1, 2, 3, 4, 5]);
    expect((await getSignInAttempt("a1", NOW))?.wrongTries).toBe(5);
  });

  it("is 0 for an attempt that has gone, and makes none", async () => {
    expect(await recordWrongTry("nope")).toBe(0);
    expect(sampleStore().signInAttempts.has("nope")).toBe(false);
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
