import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getSampleEmail, recordCodeSent } from "@/lib/data/sign-in";
import { resetSampleStore, sampleStore } from "@/lib/data/store";
import { redirectOf, redirectSignalOf, resetRequest, type FakeRequest } from "@/tests/helpers/next-request";
import { cancelSignIn, resendCode, startSignIn } from "./actions";
import { SIGN_IN_COOKIE } from "./cookies";
import { hashToken } from "./secrets";
import { finishCode } from "./sign-in-finish";

const request = vi.hoisted((): FakeRequest => ({ cookies: new Map(), sent: new Map(), proto: "http" }));

vi.mock("next/headers", async () => (await import("@/tests/helpers/next-request")).nextHeaders(request));
vi.mock("next/navigation", async () => (await import("@/tests/helpers/next-request")).nextNavigation());
vi.mock("next/server", async () => (await import("@/tests/helpers/next-request")).nextServer());
vi.mock("next/cache", async () => (await import("@/tests/helpers/next-request")).nextCache(request));

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

/** A form's fields, as the browser posts them. */
function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) data.append(name, value);
  return data;
}

/** This browser's attempt, straight from the store, or null. */
function attempt() {
  const token = request.cookies.get(SIGN_IN_COOKIE);
  return token ? (sampleStore().signInAttempts.get(hashToken(token)) ?? null) : null;
}

/** The code sample mode "sent" for this browser's attempt. */
async function sentCode(): Promise<string> {
  return (await getSampleEmail(attempt()!.key))!.code;
}

/** A code that isn't the one sent. */
async function wrongCode(): Promise<string> {
  return (await sentCode()) === "111111" ? "222222" : "111111";
}

/** Step 1 for `email`, with the box ticked, coming back to `next`. */
function start(email: string, next = "/listings/l-001") {
  return redirectSignalOf(() => startSignIn(form({ email, consent: "yes", next })));
}

describe("step 1: the email and the privacy box (accounts spec 3.1)", () => {
  it("sends a code to an Eduvos email and moves on to step 2, keeping next in the address", async () => {
    const redirect = await start("  Thandi@Eduvos.com ");
    expect([redirect.url, redirect.type]).toEqual(["/login?next=%2Flistings%2Fl-001", "replace"]);
    expect(attempt()).toMatchObject({
      step: "code",
      email: "thandi@eduvos.com",
      errors: [],
      wrongTries: 0,
      consentedAt: NOW.toISOString(),
      codeExpiresAt: "2026-10-14T08:52:00.000Z",
    });
    expect(await sentCode()).toMatch(/^\d{6}$/);
  });

  it("keeps the attempt behind an httpOnly cookie for 30 minutes, with only its token's hash in the store", async () => {
    await start("thandi@eduvos.com");
    const token = request.cookies.get(SIGN_IN_COOKIE)!;
    expect(request.sent.get(SIGN_IN_COOKIE)?.options).toMatchObject({
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 1800,
    });
    expect(sampleStore().signInAttempts.has(token)).toBe(false);
    expect(attempt()?.expiresAt).toBe("2026-10-14T09:12:00.000Z");
  });

  it("keeps only the code's hash on the attempt (spec 5)", async () => {
    await start("thandi@eduvos.com");
    const code = await sentCode();
    expect(attempt()?.codeHash).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(attempt())).not.toContain(code);
  });

  it("asks for the email and the box together", async () => {
    await redirectSignalOf(() => startSignIn(form({ email: " ", next: "/listings/l-001" })));
    expect(attempt()).toMatchObject({
      step: "email",
      errors: ["email-missing", "consent-missing"],
      consentedAt: null,
      postedAt: NOW.toISOString(),
    });
    expect(sampleStore().sampleEmails.size).toBe(0);
  });

  it("turns other domains away, keeping what was typed so the field can show it", async () => {
    await start("thandi@gmail.com");
    expect(attempt()).toMatchObject({ step: "email", email: "thandi@gmail.com", errors: ["email-domain"] });
    expect(sampleStore().sampleEmails.size).toBe(0);
  });

  it("allows 5 codes an hour for an email (spec 5)", async () => {
    for (const minutes of [0, 5, 10, 15, 20]) {
      await recordCodeSent("thandi@eduvos.com", new Date(NOW.getTime() - minutes * 60_000));
    }
    await start("thandi@eduvos.com");
    expect(attempt()).toMatchObject({ step: "email", errors: ["email-rate"] });
  });

  it("starts a new attempt under a new token each time", async () => {
    await start("thandi@eduvos.com");
    const firstToken = request.cookies.get(SIGN_IN_COOKIE);
    const firstKey = attempt()!.key;
    await start("thandi@eduvos.com");
    expect(request.cookies.get(SIGN_IN_COOKIE)).not.toBe(firstToken);
    expect(sampleStore().signInAttempts.has(firstKey)).toBe(false);
  });

  it("drops a next that leads off the site", async () => {
    expect((await start("thandi@eduvos.com", "//evil.example")).url).toBe("/login");
  });

  it("keeps no per-network budget in sample mode: 20 sends from one IP address all go (phase B review fix 2)", async () => {
    request.headers = { "x-real-ip": "196.25.1.1" };
    for (let n = 1; n <= 20; n += 1) {
      await start(`student${n}@eduvos.com`);
      expect(attempt()).toMatchObject({ step: "code", errors: [] });
    }
  });

  it("does nothing with sample mode off (spec 2.1)", async () => {
    vi.stubEnv("VOSSIE_SAMPLE_MODE", "0");
    expect((await start("thandi@eduvos.com")).url).toBe("/login?next=%2Flistings%2Fl-001");
    expect(attempt()).toBeNull();
  });
});

describe("sending a new code (plan decision 6)", () => {
  it("sends a new code with 5 fresh tries, and says so", async () => {
    await start("thandi@eduvos.com");
    await finishCode(form({ code: await wrongCode() }), new Date());
    vi.setSystemTime(new Date("2026-10-14T08:43:00.000Z"));
    await redirectSignalOf(() => resendCode(form({})));
    expect(attempt()).toMatchObject({
      step: "code",
      wrongTries: 0,
      errors: [],
      resent: true,
      codeExpiresAt: "2026-10-14T08:53:00.000Z",
    });
    expect(sampleStore().codeSends.get("thandi@eduvos.com")).toHaveLength(2);
  });

  it("stops at 5 codes an hour", async () => {
    await start("thandi@eduvos.com");
    for (let sent = 2; sent <= 5; sent++) await redirectSignalOf(() => resendCode(form({})));
    expect(attempt()).toMatchObject({ resent: true, errors: [] });
    await redirectSignalOf(() => resendCode(form({})));
    expect(attempt()).toMatchObject({ step: "code", resent: false, errors: ["code-rate"] });
  });

  it("never goes past 5 codes an hour, even when posts overlap", async () => {
    await start("thandi@eduvos.com");
    for (let sent = 2; sent <= 4; sent++) await redirectSignalOf(() => resendCode(form({})));
    expect(sampleStore().codeSends.get("thandi@eduvos.com")).toHaveLength(4);
    await Promise.all(Array.from({ length: 4 }, () => redirectSignalOf(() => resendCode(form({})))));
    expect(sampleStore().codeSends.get("thandi@eduvos.com")).toHaveLength(5);
  });

  it("stops saying \"We sent a new code\" after the next try", async () => {
    await start("thandi@eduvos.com");
    await redirectSignalOf(() => resendCode(form({})));
    await finishCode(form({ code: await wrongCode() }), new Date());
    expect(attempt()?.resent).toBe(false);
  });
});

describe("using a different email (accounts spec 3.1)", () => {
  it("ends the attempt and goes back to an empty step 1", async () => {
    await start("thandi@eduvos.com");
    const key = attempt()!.key;
    expect(await redirectOf(() => cancelSignIn(form({ next: "/listings/l-001" })))).toBe("/login?next=%2Flistings%2Fl-001");
    expect(request.cookies.has(SIGN_IN_COOKIE)).toBe(false);
    expect(sampleStore().signInAttempts.has(key)).toBe(false);
    expect(await getSampleEmail(key)).toBeNull();
  });
});
