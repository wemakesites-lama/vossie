import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createAccount, deleteAccountData, findAccountByEmail, getLatestConsent } from "@/lib/data/accounts";
import { getSampleEmail, recordCodeSent } from "@/lib/data/sign-in";
import { resetSampleStore, sampleStore } from "@/lib/data/store";
import { redirectSignalOf, resetRequest, type FakeRequest } from "@/tests/helpers/next-request";
import { form } from "@/tests/helpers/staff";
import { resendCode, startSignIn } from "./actions";
import { SESSION_COOKIE, SIGN_IN_COOKIE } from "./cookies";
import { hashToken } from "./secrets";
import { getViewer } from "./session";
import { afterSignInPath, finishCode, finishProfile, finishSample, signInPath } from "./sign-in-finish";

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

/** This browser's attempt, straight from the store, or null. */
function attempt() {
  const token = request.cookies.get(SIGN_IN_COOKIE);
  return token ? (sampleStore().signInAttempts.get(hashToken(token)) ?? null) : null;
}

async function sentCode(): Promise<string> {
  return (await getSampleEmail(attempt()!.key))!.code;
}

async function wrongCode(): Promise<string> {
  return (await sentCode()) === "111111" ? "222222" : "111111";
}

/** Step 1 (still a Server Action) for `email`, with the box ticked, coming back to `next`. */
function start(email: string, next = "/listings/l-001") {
  return redirectSignalOf(() => startSignIn(form({ email, consent: "yes", next })));
}

const code = (fields: Record<string, string>) => finishCode(form(fields), new Date());
const profile = (fields: Record<string, string>) => finishProfile(form(fields), new Date());
const sample = (fields: Record<string, string>) => finishSample(form(fields), new Date());

describe("where a step goes (stage K spec section 3)", () => {
  it("goes back to sign-in, keeping next", () => {
    expect(signInPath(null)).toBe("/login");
    expect(signInPath("/listings/l-001")).toBe("/login?next=%2Flistings%2Fl-001");
  });

  it("finishes at next, unless it's missing or under /login, then at the account (accounts plan decision 9)", () => {
    expect(afterSignInPath("/saved")).toBe("/saved");
    expect(afterSignInPath(null)).toBe("/account");
    expect(afterSignInPath("/login?next=%2Fsaved")).toBe("/account");
  });
});

describe("step 2: the code (accounts spec 3.1)", () => {
  it("signs an existing account straight in and follows next", async () => {
    await start("student@eduvos.com");
    expect(await code({ code: await sentCode(), next: "/listings/l-001" })).toBe("/listings/l-001");
    expect((await getViewer())?.email).toBe("student@eduvos.com");
    expect(request.cookies.has(SIGN_IN_COOKIE)).toBe(false);
    expect(sampleStore().signInAttempts.size).toBe(0);
  });

  it("goes to the account page when next is missing, or is the sign-in page itself", async () => {
    await redirectSignalOf(() => startSignIn(form({ email: "student@eduvos.com", consent: "yes" })));
    expect(await code({ code: await sentCode() })).toBe("/account");
    await start("student@eduvos.com", "/login?next=%2Fsaved");
    expect(await code({ code: await sentCode(), next: "/login?next=%2Fsaved" })).toBe("/account");
  });

  it("ignores spaces in the code", async () => {
    await start("student@eduvos.com");
    const sent = await sentCode();
    expect(await code({ code: `${sent.slice(0, 3)} ${sent.slice(3)}`, next: "/saved" })).toBe("/saved");
  });

  it("moves a new email on to step 3 without making an account yet", async () => {
    await start("new@eduvos.com");
    expect(await code({ code: await sentCode(), next: "/listings/l-001" })).toBe("/login?next=%2Flistings%2Fl-001");
    expect(attempt()).toMatchObject({ step: "profile", codeHash: null, errors: [] });
    expect(await findAccountByEmail("new@eduvos.com")).toBeNull();
    expect(request.cookies.has(SESSION_COOKIE)).toBe(false);
  });

  it("counts wrong tries, and the fifth ends the attempt, back on step 1 with the email kept", async () => {
    await start("thandi@eduvos.com");
    const wrong = await wrongCode();
    for (let tries = 1; tries <= 4; tries++) {
      expect(await code({ code: wrong, next: "/saved" })).toBe("/login?next=%2Fsaved");
      expect(attempt()).toMatchObject({ step: "code", wrongTries: tries, errors: ["code-wrong"] });
    }
    await code({ code: wrong });
    expect(attempt()).toMatchObject({ step: "email", email: "thandi@eduvos.com", codeHash: null, errors: ["locked"] });
  });

  it("counts every wrong try, even when posts overlap", async () => {
    await start("thandi@eduvos.com");
    const wrong = await wrongCode();
    await Promise.all(Array.from({ length: 3 }, () => code({ code: wrong })));
    expect(attempt()).toMatchObject({ step: "code", wrongTries: 3 });
    await Promise.all(Array.from({ length: 2 }, () => code({ code: wrong })));
    expect(attempt()).toMatchObject({ step: "email", codeHash: null, errors: ["locked"] });
  });

  it("refuses the right code once its 10 minutes are up", async () => {
    await start("student@eduvos.com");
    const sent = await sentCode();
    vi.setSystemTime(new Date("2026-10-14T08:52:00.000Z"));
    await code({ code: sent });
    expect(attempt()).toMatchObject({ step: "code", errors: ["code-expired"] });
    expect(request.cookies.has(SESSION_COOKIE)).toBe(false);
  });

  it("asks for 6 digits without using a try", async () => {
    await start("thandi@eduvos.com");
    for (const typed of ["", "12345", "1234567", "12a456"]) {
      await code({ code: typed });
      expect(attempt()).toMatchObject({ errors: ["code-missing"], wrongTries: 0 });
    }
  });

  it("sends a browser with no attempt back to sign-in", async () => {
    expect(await code({ code: "123456", next: "/saved" })).toBe("/login?next=%2Fsaved");
    expect(request.cookies.has(SESSION_COOKIE)).toBe(false);
  });

  it("does nothing with sample mode off (spec 2.1)", async () => {
    await start("student@eduvos.com");
    const sent = await sentCode();
    vi.stubEnv("VOSSIE_SAMPLE_MODE", "0");
    expect(await code({ code: sent, next: "/saved" })).toBe("/login?next=%2Fsaved");
    expect(request.cookies.has(SESSION_COOKIE)).toBe(false);
  });
});

describe("the stamp that lets a step's errors show only straight after their post (accounts spec 3.1)", () => {
  const at = (seconds: number) => vi.setSystemTime(new Date(NOW.getTime() + seconds * 1000));
  const stamp = (seconds: number) => new Date(NOW.getTime() + seconds * 1000).toISOString();

  it("stamps the attempt with the time of every post that saves it", async () => {
    await start("thandi@eduvos.com");
    expect(attempt()?.postedAt).toBe(stamp(0));
    at(5);
    await code({ code: await wrongCode() });
    expect(attempt()).toMatchObject({ errors: ["code-wrong"], postedAt: stamp(5) });
    at(10);
    await redirectSignalOf(() => resendCode(form({})));
    expect(attempt()).toMatchObject({ resent: true, postedAt: stamp(10) });
    at(15);
    await code({ code: await sentCode() });
    expect(attempt()).toMatchObject({ step: "profile", postedAt: stamp(15) });
    at(20);
    await profile({ firstName: "A", campus: "atlantis" });
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

describe("step 3: first sign-in (accounts spec 2.6)", () => {
  async function toStep3() {
    await start("new@eduvos.com");
    await code({ code: await sentCode() });
  }

  it("makes the account with the name and campus, records consent, signs in and follows next", async () => {
    await toStep3();
    vi.setSystemTime(new Date("2026-10-14T08:45:00.000Z"));
    expect(await profile({ firstName: "  Ayanda ", campus: "pretoria", next: "/listings/l-001" })).toBe(
      "/listings/l-001",
    );
    const account = await findAccountByEmail("new@eduvos.com");
    expect(account).toMatchObject({ firstName: "Ayanda", campusSlug: "pretoria", roles: [], createdAt: "2026-10-14T08:45:00.000Z" });
    expect(await getLatestConsent(account!.id)).toEqual({ version: "2026-10-draft", agreedAt: NOW.toISOString() });
    expect((await getViewer())?.id).toBe(account!.id);
    expect(request.cookies.has(SIGN_IN_COOKIE)).toBe(false);
  });

  it("keeps step 3's answers and says what's wrong, making nothing", async () => {
    await toStep3();
    expect(await profile({ firstName: "A", campus: "atlantis", next: "/saved" })).toBe("/login?next=%2Fsaved");
    expect(attempt()).toMatchObject({ step: "profile", errors: ["first-name-length", "campus-missing"], firstName: "A", campusSlug: "" });
    await profile({ firstName: "", campus: "midrand" });
    expect(attempt()).toMatchObject({ errors: ["first-name-missing"], campusSlug: "midrand" });
    expect(await findAccountByEmail("new@eduvos.com")).toBeNull();
  });

  it("signs in to the account another tab made first, rather than making a second", async () => {
    await toStep3();
    const other = await createAccount({ email: "new@eduvos.com", firstName: "Zola", campusSlug: "midrand", now: NOW });
    await profile({ firstName: "Ayanda", campus: "pretoria" });
    expect((await getViewer())?.id).toBe(other.id);
    expect([...sampleStore().accounts.values()].filter((row) => row.email === "new@eduvos.com")).toHaveLength(1);
  });

  it("can't be reached without the right code", async () => {
    await start("new@eduvos.com");
    expect(await profile({ firstName: "Ayanda", campus: "pretoria" })).toBe("/login");
    expect(await findAccountByEmail("new@eduvos.com")).toBeNull();
  });

  it("can't be finished once the attempt's 30 minutes are up", async () => {
    await toStep3();
    vi.setSystemTime(new Date("2026-10-14T09:12:00.000Z"));
    expect(await profile({ firstName: "Ayanda", campus: "pretoria" })).toBe("/login");
    expect(await findAccountByEmail("new@eduvos.com")).toBeNull();
  });
});

describe("the sample accounts' buttons (accounts spec 2.8)", () => {
  it("signs straight in as a sample account and follows next", async () => {
    expect(await sample({ email: "mentor@eduvos.com", next: "/saved" })).toBe("/saved");
    expect((await getViewer())?.roles).toEqual(["mentor"]);
  });

  it("only signs in as one of the five", async () => {
    await createAccount({ email: "someone@eduvos.com", firstName: "Zola", campusSlug: "midrand", now: NOW });
    expect(await sample({ email: "someone@eduvos.com" })).toBe("/login");
    expect(request.cookies.has(SESSION_COOKIE)).toBe(false);
  });

  it("puts a deleted sample account back first", async () => {
    sampleStore().accounts.delete("acc-admin");
    await sample({ email: "admin@eduvos.com" });
    expect((await getViewer())?.id).toBe("acc-admin");
  });

  it("brings a deleted sample seller's shop back, expiring the sellers tag with revalidateTag, never updateTag", async () => {
    await deleteAccountData("acc-seller");
    expect(sampleStore().sellers.has("tech-corner")).toBe(false);
    await sample({ email: "seller@eduvos.com" });
    expect(sampleStore().sellers.get("tech-corner")?.ownerId).toBe("acc-seller");
    expect(sampleStore().listings.has("l-001")).toBe(true);
    // A Route Handler can't call updateTag (stage K spec decision 4).
    expect(request.revalidatedTags).toEqual([{ tag: "sellers", profile: { expire: 0 } }]);
    expect(request.updatedTags).toEqual([]);
  });

  it("expires nothing when the sample account has no shop to bring back", async () => {
    await sample({ email: "student@eduvos.com" });
    await sample({ email: "seller@eduvos.com" });
    expect(request.revalidatedTags).toEqual([]);
  });

  it("ends a sign-in that was under way", async () => {
    await start("thandi@eduvos.com");
    const key = attempt()!.key;
    await sample({ email: "student@eduvos.com" });
    expect(sampleStore().signInAttempts.has(key)).toBe(false);
    expect(request.cookies.has(SIGN_IN_COOKIE)).toBe(false);
  });

  it("is off with sample mode off", async () => {
    vi.stubEnv("VOSSIE_SAMPLE_MODE", "0");
    expect(await sample({ email: "student@eduvos.com" })).toBe("/login");
    expect(request.cookies.has(SESSION_COOKIE)).toBe(false);
  });
});
