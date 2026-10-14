import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SignInAttemptRow } from "@/lib/data/rows";
import { createSession } from "@/lib/data/sessions";
import { saveSampleEmail, saveSignInAttempt } from "@/lib/data/sign-in";
import { resetSampleStore } from "@/lib/data/store";
import { makeSignInAttempt } from "@/tests/helpers/fakes";
import { resetRequest, type FakeRequest } from "@/tests/helpers/next-request";
import { SESSION_COOKIE, SIGN_IN_COOKIE } from "./cookies";
import { hashToken } from "./secrets";
import { getSignInView } from "./sign-in-view";

const request = vi.hoisted((): FakeRequest => ({ cookies: new Map(), sent: new Map(), proto: "http" }));

vi.mock("next/headers", async () => (await import("@/tests/helpers/next-request")).nextHeaders(request));
vi.mock("next/navigation", async () => (await import("@/tests/helpers/next-request")).nextNavigation());
vi.mock("next/server", async () => (await import("@/tests/helpers/next-request")).nextServer());

const NOW = new Date("2026-10-14T08:42:00.000Z");

beforeEach(() => {
  resetSampleStore();
  resetRequest(request);
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

/** An attempt in the store, and its token in the browser's cookie. */
async function withAttempt(fields: Partial<SignInAttemptRow>) {
  await saveSignInAttempt(makeSignInAttempt({ key: hashToken("attempt-token"), ...fields }), NOW);
  request.cookies.set(SIGN_IN_COOKIE, "attempt-token");
}

describe("getSignInView (accounts spec 3.1)", () => {
  it("starts on an empty step 1", async () => {
    expect(await getSignInView()).toEqual({ step: "email", email: "", consented: false, errors: [] });
  });

  it("shows step 1 again with what was typed and what went wrong", async () => {
    await withAttempt({ step: "email", email: "thandi@gmail.com", consentedAt: NOW.toISOString(), errors: ["email-domain"] });
    expect(await getSignInView()).toEqual({
      step: "email",
      email: "thandi@gmail.com",
      consented: true,
      errors: [{ message: "Use your Eduvos email address.", fieldId: "signin-email" }],
    });
  });

  it("shows step 2 with the masked email, the sample code and the tries left", async () => {
    await withAttempt({ step: "code", email: "thandi@eduvos.com", wrongTries: 2, errors: ["code-wrong"] });
    await saveSampleEmail({
      attemptKey: hashToken("attempt-token"),
      to: "thandi@eduvos.com",
      code: "042137",
      sentAt: NOW.toISOString(),
    });
    expect(await getSignInView()).toEqual({
      step: "code",
      maskedEmail: "t•••@eduvos.com",
      errors: [{ message: "That code isn't right. 3 tries left.", fieldId: "signin-code" }],
      resent: false,
      sampleCode: "042137",
    });
  });

  it("starts step 3's campus on the one chosen on this device, or on none (spec 2.6)", async () => {
    await withAttempt({ step: "profile" });
    request.cookies.set("vossie_campus", "pretoria");
    expect(await getSignInView()).toMatchObject({ step: "profile", campus: "pretoria", firstName: "" });
    request.cookies.set("vossie_campus", "all");
    expect(await getSignInView()).toMatchObject({ campus: "" });
  });

  it("keeps step 3's typed answers ahead of the device's campus", async () => {
    await withAttempt({ step: "profile", firstName: "A", campusSlug: "midrand", errors: ["first-name-length"] });
    request.cookies.set("vossie_campus", "pretoria");
    expect(await getSignInView()).toMatchObject({ firstName: "A", campus: "midrand" });
  });

  it("forgets an attempt that has run out", async () => {
    await withAttempt({ step: "code", email: "thandi@eduvos.com", expiresAt: "2026-10-14T08:00:00.000Z" });
    expect((await getSignInView()).step).toBe("email");
  });

  it("says who's signed in, ahead of any attempt", async () => {
    await withAttempt({ step: "code", email: "thandi@eduvos.com" });
    await createSession({
      key: hashToken("session-token"),
      accountId: "acc-student",
      createdAt: NOW,
      expiresAt: new Date("2026-11-13T08:42:00.000Z"),
    });
    request.cookies.set(SESSION_COOKIE, "session-token");
    expect(await getSignInView()).toEqual({ step: "signed-in", email: "student@eduvos.com" });
  });

  it("is unavailable with sample mode off (spec 2.1)", async () => {
    vi.stubEnv("VOSSIE_SAMPLE_MODE", "0");
    expect(await getSignInView()).toEqual({ step: "unavailable" });
  });
});
