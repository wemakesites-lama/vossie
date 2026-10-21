import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetSampleStore, sampleStore } from "@/lib/data/store";
import { redirectSignalOf, resetRequest, type FakeRequest } from "@/tests/helpers/next-request";
import { resetSupabaseFakes, supabaseAccount, type SupabaseFakes } from "@/tests/helpers/supabase-auth-fakes";
import { form } from "@/tests/helpers/staff";
import { resendCode, startSignIn } from "./actions";
import { CODE_TTL_MS, POLICY_VERSION } from "./config";
import { SIGN_IN_COOKIE } from "./cookies";
import { hashIp, hashToken } from "./secrets";
import { finishCode, finishProfile, finishSample } from "./sign-in-finish";
import { getSignInView } from "./sign-in-view";

// Signing in on Supabase (Supabase phase B, Task 5; decisions 1, 2 and 6; amendments 2, 6, 11, 12 and 18): step 1 and
// "Send a new code" (Server Actions), the code and step 3 (the Route Handlers' helpers), and the sign-in page's view.
// Supabase is replaced by tests/helpers/supabase-auth-fakes.ts. The sample paths' tests are in sign-in-actions,
// sign-in-finish and sign-in-view's own files, and pass unchanged.

const request = vi.hoisted((): FakeRequest => ({ cookies: new Map(), sent: new Map(), proto: "http" }));
const supabase = vi.hoisted(() => ({}) as SupabaseFakes);

vi.mock("next/headers", async () => (await import("@/tests/helpers/next-request")).nextHeaders(request));
vi.mock("next/navigation", async () => (await import("@/tests/helpers/next-request")).nextNavigation());
vi.mock("next/server", async () => (await import("@/tests/helpers/next-request")).nextServer());
vi.mock("next/cache", async () => (await import("@/tests/helpers/next-request")).nextCache(request));
vi.mock("@/lib/data/auth-session", async () => (await import("@/tests/helpers/supabase-auth-fakes")).authSessionModule(supabase));
vi.mock("@/lib/data/supabase/sign-in", async () => (await import("@/tests/helpers/supabase-auth-fakes")).signInTwin(supabase));
vi.mock("@/lib/data/supabase/accounts", async () => (await import("@/tests/helpers/supabase-auth-fakes")).accountsTwin(supabase));
vi.mock("@/lib/data/supabase/form-states", async () => (await import("@/tests/helpers/supabase-auth-fakes")).formStatesTwin(supabase));

const NOW = new Date("2026-10-21T08:42:00.000Z");
const EMAIL = "eduv1234567@vossie.net";
const NEXT = "/listings/l-001";

beforeEach(() => {
  resetSampleStore();
  resetRequest(request);
  resetSupabaseFakes(supabase);
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  vi.stubEnv("VOSSIE_BACKEND", "supabase");
  vi.stubEnv("VOSSIE_AUTH_HMAC_KEY", "k".repeat(43) + "=");
  vi.stubEnv("VOSSIE_EMAIL_DOMAINS", "vossie.net,eduvos.com");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

/** This browser's attempt, as the sign-in twin keeps it, or null. */
function attempt() {
  const token = request.cookies.get(SIGN_IN_COOKIE);
  return token ? (supabase.attempts.get(hashToken(token)) ?? null) : null;
}

/** Step 1 for `email`, with the box ticked. */
function start(email = EMAIL) {
  return redirectSignalOf(() => startSignIn(form({ email, consent: "yes", next: NEXT })));
}

/** Step 1, then the attempt on step 2 with `changes`. */
async function onStep2(changes: Partial<ReturnType<typeof attempt> & object> = {}) {
  await start();
  Object.assign(attempt()!, changes);
  supabase.calls = [];
}

const code = (value: string) => finishCode(form({ code: value, next: NEXT }), new Date());
const profile = (fields: Record<string, string>) => finishProfile(form({ ...fields, next: NEXT }), new Date());
const resend = () => redirectSignalOf(() => resendCode(form({ next: NEXT })));
const without = (calls: string[], ...left: string[]) => calls.filter((call) => !left.includes(call));

describe("step 1 on Supabase (decision 6)", () => {
  it("reserves one of the hour's codes, then asks Supabase to send it, and moves to step 2 for 10 minutes", async () => {
    expect((await start()).url).toBe("/login?next=%2Flistings%2Fl-001");
    expect(without(supabase.calls, "save")).toEqual(["reserve", `send:${EMAIL}`]);
    expect(attempt()).toMatchObject({
      step: "code",
      email: EMAIL,
      errors: [],
      codeHash: null,
      wrongTries: 0,
      codeExpiresAt: new Date(NOW.getTime() + CODE_TTL_MS).toISOString(),
    });
  });

  const refusals: [SupabaseFakes["sendOutcome"], string][] = [
    ["too-soon", "code-soon"],
    ["ip-rate", "ip-rate"],
    ["refused", "email-domain"],
    ["failed", "send-failed"],
  ];
  for (const [outcome, error] of refusals) {
    it(`stays on step 1 with ${error} when Supabase says ${outcome}, so the visitor can try again`, async () => {
      supabase.sendOutcome = outcome;
      await start();
      expect(attempt()).toMatchObject({ step: "email", email: EMAIL, errors: [error], codeExpiresAt: null });
    });
  }

  it("says the hour's codes are used up without asking Supabase", async () => {
    supabase.reserveAnswer = false;
    await start();
    expect(attempt()).toMatchObject({ step: "email", errors: ["email-rate"] });
    expect(supabase.calls.some((call) => call.startsWith("send:"))).toBe(false);
  });

  it("refuses an address outside the allowed domains before reserving or sending", async () => {
    await start("thandi@gmail.com");
    expect(attempt()).toMatchObject({ step: "email", errors: ["email-domain"] });
    expect(without(supabase.calls, "save")).toEqual([]);
  });
});

describe("step 2 on Supabase (decision 2; amendments 2, 12 and 18)", () => {
  it("doesn't count a code that isn't 6 digits, or one past its 10 minutes, and asks Supabase nothing", async () => {
    await onStep2();
    await code("12 34");
    expect(attempt()?.errors).toEqual(["code-missing"]);
    vi.setSystemTime(new Date(NOW.getTime() + CODE_TTL_MS));
    await code("123456");
    expect(attempt()?.errors).toEqual(["code-expired"]);
    expect(without(supabase.calls, "save")).toEqual([]);
    expect(attempt()?.wrongTries).toBe(0);
  });

  it("counts every try before Supabase sees the code", async () => {
    await onStep2();
    await code("123456");
    expect(without(supabase.calls, "save", "readClaims").slice(0, 2)).toEqual(["recordWrongTry", "verify:123456"]);
  });

  it("says how many tries are left after a wrong code", async () => {
    await onStep2({ wrongTries: 2 });
    expect(await code("123456")).toBe("/login?next=%2Flistings%2Fl-001");
    expect(attempt()).toMatchObject({ step: "code", wrongTries: 3, errors: ["code-wrong"] });
    expect((await getSignInView()) as { errors: unknown }).toMatchObject({
      step: "code",
      errors: [{ message: "That code isn't right. 2 tries left.", fieldId: "signin-code" }],
    });
  });

  it("ends the attempt on the fifth wrong try: back to step 1, the email kept", async () => {
    await onStep2({ wrongTries: 4 });
    await code("123456");
    expect(attempt()).toMatchObject({ step: "email", email: EMAIL, errors: ["locked"], codeExpiresAt: null, wrongTries: 5 });
  });

  it("refuses a sixth post without asking Supabase", async () => {
    await onStep2({ wrongTries: 5 });
    await code("123456");
    expect(supabase.calls.some((call) => call.startsWith("verify:"))).toBe(false);
    expect(attempt()).toMatchObject({ step: "email", errors: ["locked"] });
  });

  it("asks Supabase nothing when the attempt went before its try was counted (amendment 2)", async () => {
    await onStep2();
    supabase.attemptGoneBeforeCount = true;
    expect(await code("123456")).toBe("/login?next=%2Flistings%2Fl-001");
    expect(supabase.calls.some((call) => call.startsWith("verify:"))).toBe(false);
  });

  it("counts a try Supabase couldn't check, and says so in its own words (amendment 18)", async () => {
    await onStep2();
    supabase.verifyOutcome = "failed";
    await code("123456");
    expect(attempt()).toMatchObject({ step: "code", wrongTries: 1, errors: ["code-check-failed"] });
    supabase.verifyOutcome = "ip-rate";
    await code("123456");
    expect(attempt()).toMatchObject({ step: "code", wrongTries: 2, errors: ["ip-rate"] });
  });

  it("signs a returning student straight in: consent recorded, the attempt ended, on to next", async () => {
    supabase.profiles.set("user-1", supabaseAccount("user-1", EMAIL));
    await onStep2();
    supabase.verifyOutcome = { ok: true, userId: "user-1" };
    expect(await code("123456")).toBe(NEXT);
    expect(supabase.consents).toEqual([{ accountId: "user-1", version: POLICY_VERSION }]);
    expect(request.cookies.has(SIGN_IN_COOKIE)).toBe(false);
    expect(supabase.attempts.size).toBe(0);
  });

  it("takes a new address on to step 3", async () => {
    await onStep2();
    supabase.verifyOutcome = { ok: true, userId: "user-new" };
    await code("123456");
    expect(attempt()).toMatchObject({ step: "profile", codeExpiresAt: null, errors: [] });
    expect(supabase.consents).toEqual([]);
  });

  it("signs a browser's old session out here before checking, so a session is never reused", async () => {
    await onStep2();
    supabase.claims = { userId: "user-a", sessionId: "session-a", email: "a@vossie.net" };
    supabase.verifyOutcome = { ok: true, userId: "user-b" };
    await code("123456");
    const calls = without(supabase.calls, "save", "readClaims");
    expect(calls.indexOf("signOutHere")).toBeGreaterThan(-1);
    expect(calls.indexOf("signOutHere")).toBeLessThan(calls.indexOf("verify:123456"));
  });
});

describe("step 3 on Supabase (decision 9; amendment 11)", () => {
  async function onStep3() {
    await onStep2();
    supabase.verifyOutcome = { ok: true, userId: "user-new" };
    await code("123456");
    supabase.calls = [];
  }

  it("keeps step 3's errors as today", async () => {
    await onStep3();
    await profile({ firstName: "", campus: "pretoria" });
    expect(attempt()).toMatchObject({ step: "profile", errors: ["first-name-missing"], campusSlug: "pretoria" });
    expect(supabase.calls).not.toContain("completeProfile");
  });

  it("finishes with complete_profile, ends the attempt, and goes on to next", async () => {
    await onStep3();
    expect(await profile({ firstName: "Thandi", campus: "pretoria" })).toBe(NEXT);
    expect(supabase.profiles.get("user-new")).toMatchObject({ firstName: "Thandi", campusSlug: "pretoria", email: EMAIL });
    expect(supabase.consents).toEqual([{ accountId: "user-new", version: POLICY_VERSION }]);
    expect(supabase.attempts.size).toBe(0);
    expect(sampleStore().accounts.size).toBe(5);
  });

  it("goes back to step 1, the attempt ended, when the session ended between the steps", async () => {
    await onStep3();
    supabase.claims = null;
    expect(await profile({ firstName: "Thandi", campus: "pretoria" })).toBe("/login?next=%2Flistings%2Fl-001");
    expect(supabase.calls).not.toContain("completeProfile");
    expect(supabase.attempts.size).toBe(0);
  });

  it("goes back to step 1 when the session is another address's", async () => {
    await onStep3();
    supabase.claims = { userId: "user-x", sessionId: "s", email: "someone@vossie.net" };
    await profile({ firstName: "Thandi", campus: "pretoria" });
    expect(supabase.calls).not.toContain("completeProfile");
    expect(supabase.attempts.size).toBe(0);
  });
});

describe("the sample accounts on Supabase (decision 1)", () => {
  it("sign nobody in", async () => {
    expect(await finishSample(form({ email: "student@eduvos.com", next: NEXT }), NOW)).toBe("/login?next=%2Flistings%2Fl-001");
    expect(request.cookies.size).toBe(0);
    expect(supabase.calls).toEqual([]);
  });
});

describe("Send a new code on Supabase (amendment 6)", () => {
  it("refuses within a minute of the last code, without using one of the hour's codes", async () => {
    await onStep2();
    vi.setSystemTime(new Date(NOW.getTime() + 59_000));
    await resend();
    expect(attempt()).toMatchObject({ step: "code", errors: ["code-soon"], resent: false });
    expect(supabase.calls).not.toContain("reserve");
  });

  it("after the minute, sends a new code with 5 fresh tries", async () => {
    await onStep2({ wrongTries: 3 });
    const later = new Date(NOW.getTime() + 61_000);
    vi.setSystemTime(later);
    await resend();
    expect(without(supabase.calls, "save")).toEqual(["reserve", `send:${EMAIL}`]);
    expect(attempt()).toMatchObject({
      resent: true,
      errors: [],
      wrongTries: 0,
      codeExpiresAt: new Date(later.getTime() + CODE_TTL_MS).toISOString(),
    });
  });

  it("says Supabase's own minute as code-soon, and the hour's codes as code-rate, on step 2", async () => {
    await onStep2();
    vi.setSystemTime(new Date(NOW.getTime() + 61_000));
    supabase.sendOutcome = "too-soon";
    await resend();
    expect(attempt()).toMatchObject({ step: "code", errors: ["code-soon"], resent: false });
    supabase.reserveAnswer = false;
    await resend();
    expect(attempt()).toMatchObject({ step: "code", errors: ["code-rate"], resent: false });
  });
});

describe("one network's codes on Supabase (review fix 2)", () => {
  const IP = "196.25.1.1";
  const address = (n: number) => `eduv${String(1_000_000 + n)}@vossie.net`;

  it("counts the network's send, under the IP's keyed hash, before the email's, then sends", async () => {
    request.headers = { "x-real-ip": IP };
    await start();
    expect(without(supabase.calls, "save")).toEqual(["reserveIp", "reserve", `send:${EMAIL}`]);
    expect([...supabase.ipSends]).toEqual([[hashIp(IP), 1]]);
  });

  it("refuses the 16th send from one network in the hour with ip-rate, asking Supabase nothing; another network still sends", async () => {
    request.headers = { "x-real-ip": IP };
    for (let n = 1; n <= 15; n += 1) {
      await start(address(n));
      expect(attempt()).toMatchObject({ step: "code", errors: [] });
    }
    supabase.calls = [];
    await start(address(16));
    expect(attempt()).toMatchObject({ step: "email", email: address(16), errors: ["ip-rate"], codeExpiresAt: null });
    expect(without(supabase.calls, "save", "deleteAttempt")).toEqual(["reserveIp"]);
    request.headers = { "x-forwarded-for": "196.25.9.9, 10.0.0.1" };
    await start(address(16));
    expect(attempt()).toMatchObject({ step: "code", errors: [] });
  });

  it("counts nothing per network when the request has no IP address, and still sends", async () => {
    await start();
    expect(without(supabase.calls, "save")).toEqual(["reserve", `send:${EMAIL}`]);
    expect(supabase.ipSends.size).toBe(0);
  });

  it("says ip-rate on step 2 when Send a new code finds the network at its limit", async () => {
    await onStep2();
    request.headers = { "x-real-ip": IP };
    supabase.ipSends.set(hashIp(IP), 15);
    vi.setSystemTime(new Date(NOW.getTime() + 61_000));
    await resend();
    expect(attempt()).toMatchObject({ step: "code", errors: ["ip-rate"], resent: false });
    expect(supabase.calls.some((call) => call === "reserve" || call.startsWith("send:"))).toBe(false);
  });
});

describe("the sign-in page on Supabase (amendment 11)", () => {
  it("is never unavailable, whatever VOSSIE_SAMPLE_MODE says", async () => {
    vi.stubEnv("VOSSIE_SAMPLE_MODE", "0");
    expect(await getSignInView()).toEqual({ step: "email", email: "", consented: false, errors: [] });
  });

  it("shows step 2 with no sample code, and Supabase's errors in the summary with no field to link to", async () => {
    await onStep2();
    vi.setSystemTime(new Date(NOW.getTime() + 61_000));
    supabase.sendOutcome = "too-soon";
    await resend();
    expect(await getSignInView()).toEqual({
      step: "code",
      maskedEmail: expect.stringContaining("@vossie.net"),
      errors: [{ message: "We sent you a code less than a minute ago. Wait a minute, then ask again.", fieldId: null }],
      resent: false,
      sampleCode: null,
    });
  });

  it("says who's signed in from the verified claims, only once there's a profile", async () => {
    supabase.claims = { userId: "user-1", sessionId: "s", email: EMAIL };
    expect((await getSignInView()).step).toBe("email");
    supabase.profiles.set("user-1", supabaseAccount("user-1", EMAIL));
    expect(await getSignInView()).toEqual({ step: "signed-in", email: EMAIL });
  });
});
