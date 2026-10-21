import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeSignInAttempt } from "@/tests/helpers/fakes";
import { fakeSupabase } from "@/tests/helpers/fake-supabase";
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

// Sign-in attempts and the code count on Supabase (phase B, Task 4): Task 2's functions through the admin client.

vi.mock("server-only", () => ({}));
const seam = vi.hoisted(() => ({ server: null as unknown }));
vi.mock("./clients", () => ({ forServer: () => seam.server }));

const NOW = new Date("2026-10-21T10:00:00.000Z");
let db: ReturnType<typeof fakeSupabase>;

beforeEach(() => {
  db = fakeSupabase();
  seam.server = db.client;
});

describe("the attempt (phase B decision 2)", () => {
  it("reads it through get_sign_in_attempt, with every time in the app's ISO form", async () => {
    db.answer("rpc:get_sign_in_attempt", {
      data: {
        key: "k",
        step: "code",
        email: "thandi@vossie.net",
        errors: ["code-wrong"],
        resent: false,
        codeHash: null,
        codeExpiresAt: "2026-10-21T10:10:00+00:00",
        wrongTries: 2,
        consentedAt: "2026-10-21T09:59:00+00:00",
        firstName: "",
        campusSlug: "",
        postedAt: null,
        expiresAt: "2026-10-21T10:30:00+00:00",
      },
    });
    expect(await getSignInAttempt("k", NOW)).toEqual({
      key: "k",
      step: "code",
      email: "thandi@vossie.net",
      errors: ["code-wrong"],
      resent: false,
      codeHash: null,
      codeExpiresAt: "2026-10-21T10:10:00.000Z",
      wrongTries: 2,
      consentedAt: "2026-10-21T09:59:00.000Z",
      firstName: "",
      campusSlug: "",
      postedAt: null,
      expiresAt: "2026-10-21T10:30:00.000Z",
    });
    expect(db.calls).toEqual([["rpc", "get_sign_in_attempt", { p_key: "k" }]]);
  });

  it("is null when there's none (or it has run out)", async () => {
    expect(await getSignInAttempt("k", NOW)).toBeNull();
  });

  it("saves it through save_sign_in_attempt, never with a code hash", async () => {
    const attempt = makeSignInAttempt({ key: "k", codeHash: "should-not-go", wrongTries: 3 });
    await saveSignInAttempt(attempt, NOW);
    expect(db.calls).toEqual([["rpc", "save_sign_in_attempt", { p_attempt: { ...attempt, codeHash: null } }]]);
  });

  it("deletes it through delete_sign_in_attempt", async () => {
    await deleteSignInAttempt("k");
    expect(db.calls).toEqual([["rpc", "delete_sign_in_attempt", { p_key: "k" }]]);
  });

  it("counts a try in one statement, and gives 0 for an attempt that has gone (never a try let through)", async () => {
    db.answer("rpc:record_wrong_try", { data: 4 }, { data: null });
    expect(await recordWrongTry("k")).toBe(4);
    expect(await recordWrongTry("gone")).toBe(0);
    expect(db.calls).toEqual([
      ["rpc", "record_wrong_try", { p_attempt_key: "k" }],
      ["rpc", "record_wrong_try", { p_attempt_key: "gone" }],
    ]);
  });

  it("throws when the database refuses, naming only the function", async () => {
    db.answer("rpc:save_sign_in_attempt", { error: { code: "22023", message: "an attempt lasts at most 30 minutes" } });
    await expect(saveSignInAttempt(makeSignInAttempt({ key: "k" }), NOW)).rejects.toThrow("save_sign_in_attempt failed (22023)");
  });
});

describe("the code count (spec 5)", () => {
  it("reserves one of the hour's codes through reserve_code_send, on the database's clock", async () => {
    db.answer("rpc:reserve_code_send", { data: true }, { data: false });
    expect(await reserveCodeSend("thandi@vossie.net", NOW, 5)).toBe(true);
    expect(await reserveCodeSend("thandi@vossie.net", NOW, 5)).toBe(false);
    expect(db.calls[0]).toEqual(["rpc", "reserve_code_send", { p_email: "thandi@vossie.net", p_max_sends: 5 }]);
  });

  it("keeps the sample store's test helpers to the sample store", async () => {
    await expect(countCodesSent("a@vossie.net", NOW)).rejects.toThrow("test-only on the sample store");
    await expect(recordCodeSent("a@vossie.net", NOW)).rejects.toThrow("test-only on the sample store");
  });
});

describe("sample mode's outbox", () => {
  it("doesn't exist on Supabase: nothing may save to it, and it reads empty", async () => {
    await expect(saveSampleEmail({ attemptKey: "k", to: "a@vossie.net", code: "123456", sentAt: NOW.toISOString() })).rejects.toThrow(
      "no sample outbox",
    );
    expect(await getSampleEmail("k")).toBeNull();
    expect(db.calls).toEqual([]);
  });
});
