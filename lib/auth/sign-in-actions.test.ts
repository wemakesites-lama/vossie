import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createAccount, deleteAccountData, findAccountByEmail, getLatestConsent } from "@/lib/data/accounts";
import { getSampleEmail, recordCodeSent } from "@/lib/data/sign-in";
import { resetSampleStore, sampleStore } from "@/lib/data/store";
import { redirectOf, redirectSignalOf, resetRequest, type FakeRequest } from "@/tests/helpers/next-request";
import { cancelSignIn, completeProfile, resendCode, signInAsSample, startSignIn, verifyCode } from "./actions";
import { SESSION_COOKIE, SIGN_IN_COOKIE } from "./cookies";
import { hashToken } from "./secrets";
import { getViewer } from "./session";

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

  it("does nothing with sample mode off (spec 2.1)", async () => {
    vi.stubEnv("VOSSIE_SAMPLE_MODE", "0");
    expect((await start("thandi@eduvos.com")).url).toBe("/login?next=%2Flistings%2Fl-001");
    expect(attempt()).toBeNull();
  });
});

describe("step 2: the code (accounts spec 3.1)", () => {
  it("signs an existing account straight in and follows next", async () => {
    await start("student@eduvos.com");
    const code = await sentCode();
    const redirect = await redirectSignalOf(() => verifyCode(form({ code, next: "/listings/l-001" })));
    // A plain redirect, so it pushes: Back returns to the sign-in page, which now says you're signed in.
    expect([redirect.url, redirect.type]).toEqual(["/listings/l-001", undefined]);
    expect((await getViewer())?.email).toBe("student@eduvos.com");
    expect(request.cookies.has(SIGN_IN_COOKIE)).toBe(false);
    expect(sampleStore().signInAttempts.size).toBe(0);
  });

  it("goes to the account page when next is missing, or is the sign-in page itself (plan decision 9)", async () => {
    await redirectSignalOf(() => startSignIn(form({ email: "student@eduvos.com", consent: "yes" })));
    expect(await redirectOf(async () => verifyCode(form({ code: await sentCode() })))).toBe("/account");
    await start("student@eduvos.com", "/login?next=%2Fsaved");
    expect(await redirectOf(async () => verifyCode(form({ code: await sentCode(), next: "/login?next=%2Fsaved" })))).toBe(
      "/account",
    );
  });

  it("ignores spaces in the code", async () => {
    await start("student@eduvos.com");
    const code = await sentCode();
    const spaced = `${code.slice(0, 3)} ${code.slice(3)}`;
    expect(await redirectOf(() => verifyCode(form({ code: spaced, next: "/saved" })))).toBe("/saved");
  });

  it("moves a new email on to step 3 without making an account yet (plan decision 8)", async () => {
    await start("new@eduvos.com");
    const code = await sentCode();
    expect(await redirectOf(() => verifyCode(form({ code, next: "/listings/l-001" })))).toBe(
      "/login?next=%2Flistings%2Fl-001",
    );
    expect(attempt()).toMatchObject({ step: "profile", codeHash: null, errors: [] });
    expect(await findAccountByEmail("new@eduvos.com")).toBeNull();
    expect(request.cookies.has(SESSION_COOKIE)).toBe(false);
  });

  it("counts wrong tries, and the fifth ends the attempt, back on step 1 with the email kept", async () => {
    await start("thandi@eduvos.com");
    const wrong = await wrongCode();
    for (let tries = 1; tries <= 4; tries++) {
      await redirectSignalOf(() => verifyCode(form({ code: wrong })));
      expect(attempt()).toMatchObject({ step: "code", wrongTries: tries, errors: ["code-wrong"] });
    }
    await redirectSignalOf(() => verifyCode(form({ code: wrong })));
    expect(attempt()).toMatchObject({ step: "email", email: "thandi@eduvos.com", codeHash: null, errors: ["locked"] });
  });

  it("counts every wrong try, even when posts overlap, so the lockout can't be slipped past", async () => {
    await start("thandi@eduvos.com");
    const wrong = await wrongCode();
    await Promise.all(Array.from({ length: 3 }, () => redirectSignalOf(() => verifyCode(form({ code: wrong })))));
    expect(attempt()).toMatchObject({ step: "code", wrongTries: 3 });
    await Promise.all(Array.from({ length: 2 }, () => redirectSignalOf(() => verifyCode(form({ code: wrong })))));
    expect(attempt()).toMatchObject({ step: "email", codeHash: null, errors: ["locked"] });
  });

  it("refuses the right code once its 10 minutes are up", async () => {
    await start("student@eduvos.com");
    const code = await sentCode();
    vi.setSystemTime(new Date("2026-10-14T08:52:00.000Z"));
    await redirectSignalOf(() => verifyCode(form({ code })));
    expect(attempt()).toMatchObject({ step: "code", errors: ["code-expired"] });
    expect(request.cookies.has(SESSION_COOKIE)).toBe(false);
  });

  it("asks for 6 digits without using a try (plan decision 6)", async () => {
    await start("thandi@eduvos.com");
    for (const code of ["", "12345", "1234567", "12a456"]) {
      await redirectSignalOf(() => verifyCode(form({ code })));
      expect(attempt()).toMatchObject({ errors: ["code-missing"], wrongTries: 0 });
    }
  });

  it("sends a browser with no attempt back to step 1", async () => {
    expect(await redirectOf(() => verifyCode(form({ code: "123456", next: "/saved" })))).toBe("/login?next=%2Fsaved");
    expect(request.cookies.has(SESSION_COOKIE)).toBe(false);
  });
});

describe("sending a new code (plan decision 6)", () => {
  it("sends a new code with 5 fresh tries, and says so", async () => {
    await start("thandi@eduvos.com");
    await redirectSignalOf(async () => verifyCode(form({ code: await wrongCode() })));
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
    await redirectSignalOf(async () => verifyCode(form({ code: await wrongCode() })));
    expect(attempt()?.resent).toBe(false);
  });
});

describe("the stamp that lets a step's errors show only straight after their post (accounts spec 3.1)", () => {
  const at = (seconds: number) => vi.setSystemTime(new Date(NOW.getTime() + seconds * 1000));
  const stamp = (seconds: number) => new Date(NOW.getTime() + seconds * 1000).toISOString();

  it("stamps the attempt with the time of every post that saves it", async () => {
    await start("thandi@eduvos.com");
    expect(attempt()?.postedAt).toBe(stamp(0));
    at(5);
    await redirectSignalOf(async () => verifyCode(form({ code: await wrongCode() })));
    expect(attempt()).toMatchObject({ errors: ["code-wrong"], postedAt: stamp(5) });
    at(10);
    await redirectSignalOf(() => resendCode(form({})));
    expect(attempt()).toMatchObject({ resent: true, postedAt: stamp(10) });
    at(15);
    await redirectSignalOf(async () => verifyCode(form({ code: await sentCode() })));
    expect(attempt()).toMatchObject({ step: "profile", postedAt: stamp(15) });
    at(20);
    await redirectSignalOf(() => completeProfile(form({ firstName: "A", campus: "atlantis" })));
    expect(attempt()).toMatchObject({ errors: ["first-name-length", "campus-missing"], postedAt: stamp(20) });
  });

  it("stamps the rate-limit error that replaces a good email's code", async () => {
    for (const minutes of [0, 5, 10, 15, 20]) {
      await recordCodeSent("thandi@eduvos.com", new Date(NOW.getTime() - minutes * 60_000));
    }
    at(7);
    await start("thandi@eduvos.com");
    expect(attempt()).toMatchObject({ errors: ["email-rate"], postedAt: stamp(7) });
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

describe("step 3: first sign-in (accounts spec 2.6)", () => {
  async function toStep3() {
    await start("new@eduvos.com");
    const code = await sentCode();
    await redirectSignalOf(() => verifyCode(form({ code })));
  }

  it("makes the account with the name and campus, records consent, signs in and follows next", async () => {
    await toStep3();
    vi.setSystemTime(new Date("2026-10-14T08:45:00.000Z"));
    const done = await redirectOf(() =>
      completeProfile(form({ firstName: "  Ayanda ", campus: "pretoria", next: "/listings/l-001" })),
    );
    expect(done).toBe("/listings/l-001");
    const account = await findAccountByEmail("new@eduvos.com");
    expect(account).toMatchObject({ firstName: "Ayanda", campusSlug: "pretoria", roles: [], createdAt: "2026-10-14T08:45:00.000Z" });
    // Consent dates from when the box was ticked, on step 1 (spec 2.7).
    expect(await getLatestConsent(account!.id)).toEqual({ version: "2026-10-draft", agreedAt: NOW.toISOString() });
    expect((await getViewer())?.id).toBe(account!.id);
    expect(request.cookies.has(SIGN_IN_COOKIE)).toBe(false);
  });

  it("keeps step 3's answers and says what's wrong, making nothing", async () => {
    await toStep3();
    await redirectSignalOf(() => completeProfile(form({ firstName: "A", campus: "atlantis" })));
    expect(attempt()).toMatchObject({
      step: "profile",
      errors: ["first-name-length", "campus-missing"],
      firstName: "A",
      campusSlug: "",
    });
    await redirectSignalOf(() => completeProfile(form({ firstName: "", campus: "midrand" })));
    expect(attempt()).toMatchObject({ errors: ["first-name-missing"], campusSlug: "midrand" });
    expect(await findAccountByEmail("new@eduvos.com")).toBeNull();
  });

  it("signs in to the account another tab made first, rather than making a second", async () => {
    await toStep3();
    const other = await createAccount({ email: "new@eduvos.com", firstName: "Zola", campusSlug: "midrand", now: NOW });
    await redirectSignalOf(() => completeProfile(form({ firstName: "Ayanda", campus: "pretoria" })));
    expect((await getViewer())?.id).toBe(other.id);
    expect([...sampleStore().accounts.values()].filter((row) => row.email === "new@eduvos.com")).toHaveLength(1);
  });

  it("can't be reached without the right code", async () => {
    await start("new@eduvos.com");
    expect(await redirectOf(() => completeProfile(form({ firstName: "Ayanda", campus: "pretoria" })))).toBe("/login");
    expect(await findAccountByEmail("new@eduvos.com")).toBeNull();
  });

  it("can't be finished once the attempt's 30 minutes are up", async () => {
    await toStep3();
    vi.setSystemTime(new Date("2026-10-14T09:12:00.000Z"));
    expect(await redirectOf(() => completeProfile(form({ firstName: "Ayanda", campus: "pretoria" })))).toBe("/login");
    expect(await findAccountByEmail("new@eduvos.com")).toBeNull();
  });
});

describe("the sample accounts' buttons (accounts spec 2.8)", () => {
  it("signs straight in as a sample account and follows next", async () => {
    expect(await redirectOf(() => signInAsSample(form({ email: "mentor@eduvos.com", next: "/saved" })))).toBe("/saved");
    expect((await getViewer())?.roles).toEqual(["mentor"]);
  });

  it("only signs in as one of the five", async () => {
    await createAccount({ email: "someone@eduvos.com", firstName: "Zola", campusSlug: "midrand", now: NOW });
    expect(await redirectOf(() => signInAsSample(form({ email: "someone@eduvos.com" })))).toBe("/login");
    expect(request.cookies.has(SESSION_COOKIE)).toBe(false);
  });

  it("puts a deleted sample account back first (plan decision 15)", async () => {
    sampleStore().accounts.delete("acc-admin");
    await redirectSignalOf(() => signInAsSample(form({ email: "admin@eduvos.com" })));
    expect((await getViewer())?.id).toBe("acc-admin");
  });

  it("brings a deleted sample seller's shop and its listings back with the account (selling plan, Task 7)", async () => {
    await deleteAccountData("acc-seller");
    expect(sampleStore().sellers.has("tech-corner")).toBe(false);
    await redirectOf(() => signInAsSample(form({ email: "seller@eduvos.com" })));
    expect(sampleStore().sellers.get("tech-corner")?.ownerId).toBe("acc-seller");
    expect(sampleStore().listings.has("l-001")).toBe(true);
  });

  it("expires the sellers tag when it brings a shop back, so the catalog shows it at once (selling spec 2.13, amendment 9.7)", async () => {
    await deleteAccountData("acc-seller");
    expect(request.updatedTags).toEqual([]);
    await redirectOf(() => signInAsSample(form({ email: "seller@eduvos.com" })));
    expect(request.updatedTags).toEqual(["sellers"]);
  });

  it("expires nothing when the sample account has no shop to bring back", async () => {
    await redirectOf(() => signInAsSample(form({ email: "student@eduvos.com" })));
    // A sample seller whose shop is still there has nothing to bring back either.
    await redirectOf(() => signInAsSample(form({ email: "seller@eduvos.com" })));
    expect(request.updatedTags).toEqual([]);
  });

  it("ends a sign-in that was under way", async () => {
    await start("thandi@eduvos.com");
    const key = attempt()!.key;
    await redirectSignalOf(() => signInAsSample(form({ email: "student@eduvos.com" })));
    expect(sampleStore().signInAttempts.has(key)).toBe(false);
    expect(request.cookies.has(SIGN_IN_COOKIE)).toBe(false);
  });

  it("is off with sample mode off", async () => {
    vi.stubEnv("VOSSIE_SAMPLE_MODE", "0");
    expect(await redirectOf(() => signInAsSample(form({ email: "student@eduvos.com" })))).toBe("/login");
    expect(request.cookies.has(SESSION_COOKIE)).toBe(false);
  });
});
