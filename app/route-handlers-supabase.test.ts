import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SESSION_COOKIE } from "@/lib/auth/cookies";
import { resetSampleStore } from "@/lib/data/store";
import type { FormStateRow } from "@/lib/data/rows";
import { FLASH_COOKIE } from "@/lib/flash";
import { resetRequest, type FakeRequest } from "@/tests/helpers/next-request";
import { form } from "@/tests/helpers/staff";
import { resetSupabaseFakes, supabaseAccount, type SupabaseFakes } from "@/tests/helpers/supabase-auth-fakes";
import { POST as deletePost } from "./account/privacy/delete/route";
import { GET as exportGet } from "./account/privacy/export/route";
import { POST as codePost } from "./login/code/route";
import { POST as profilePost } from "./login/profile/route";
import { POST as samplePost } from "./login/sample/route";
import { POST as logoutPost } from "./logout/route";

// Stage K's Route Handlers on Supabase (phase B, Task 7). Their shape doesn't change: the Origin first, the body read
// with a catch, a 303. Supabase is replaced by tests/helpers/supabase-auth-fakes.ts; the sample paths' own tests sit
// next to each route.

const request = vi.hoisted((): FakeRequest => ({ cookies: new Map(), sent: new Map(), proto: "http" }));
const supabase = vi.hoisted(() => ({}) as SupabaseFakes);
const twin = vi.hoisted(() => ({
  deleteAccountData: vi.fn(async (id: string) => void id),
  saved: [] as FormStateRow[],
  sessions: [] as { key: string; accountId: string; createdAt: string; expiresAt: string }[],
}));
const finish = vi.hoisted(() => ({ code: vi.fn(), profile: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("next/headers", async () => (await import("@/tests/helpers/next-request")).nextHeaders(request));
vi.mock("next/navigation", async () => (await import("@/tests/helpers/next-request")).nextNavigation());
vi.mock("next/server", async () => (await import("@/tests/helpers/next-request")).nextServer());
vi.mock("next/cache", async () => (await import("@/tests/helpers/next-request")).nextCache(request));
vi.mock("@/lib/data/auth-session", async () => (await import("@/tests/helpers/supabase-auth-fakes")).authSessionModule(supabase));
vi.mock("@/lib/data/supabase/accounts", async () => {
  const fakes = await import("@/tests/helpers/supabase-auth-fakes");
  return {
    ...fakes.accountsTwin(supabase),
    deleteAccountData: twin.deleteAccountData,
    // The twin's own reads are tested in lib/data/supabase; the export's assembly and its sessions are the point here.
    exportAccountData: async (accountId: string, now: Date) => {
      const account = supabase.profiles.get(accountId);
      if (!account) return null;
      const { assembleExport } = await import("@/lib/data/accounts");
      return assembleExport({ account, consents: [{ policy: "2026-10-14", agreedAt: "2026-10-21T08:00:00.000Z" }] }, now);
    },
  };
});
vi.mock("@/lib/data/supabase/form-states", async () => ({
  ...(await import("@/tests/helpers/supabase-auth-fakes")).formStatesTwin(supabase),
  saveFormState: async (state: FormStateRow) => {
    twin.saved.push(structuredClone(state));
  },
}));
// Requests settle on Supabase before the export reads them (C1's twin); here there are none to settle.
vi.mock("@/lib/data/supabase/requests", () => ({ settleRequests: async () => 0 }));
// Selling's export reads the owner's shop on Supabase (C2/C3 plan Task 8's twin); here there is none.
vi.mock("@/lib/data/supabase/shops", () => ({ exportShop: async () => ({ shop: null, listings: [], onboardingDraft: null }) }));
// Messaging's export reads the account's conversations, reports and notifications on Supabase (C2/C3 plan Tasks 12 to
// 14's twins); here there are none.
vi.mock("@/lib/data/supabase/messages", () => ({ exportConversations: async () => [] }));
vi.mock("@/lib/data/supabase/reports", () => ({ exportReports: async () => [] }));
vi.mock("@/lib/data/supabase/notifications", () => ({ exportNotifications: async () => [] }));
vi.mock("@/lib/data/supabase/sessions", () => ({
  listSessions: async () => structuredClone(twin.sessions),
}));
vi.mock("@/lib/auth/sign-in-finish", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/auth/sign-in-finish")>()),
  finishCode: finish.code,
  finishProfile: finish.profile,
}));

const NOW = new Date("2026-10-21T08:42:00.000Z");
const CLAIMS = { userId: "11111111-1111-4111-8111-111111111111", sessionId: "session-1", email: "thandi@vossie.net" };
const PAGE = "/account/privacy";

beforeEach(() => {
  resetSampleStore();
  resetRequest(request);
  resetSupabaseFakes(supabase);
  twin.saved = [];
  twin.sessions = [];
  twin.deleteAccountData.mockReset();
  finish.code.mockReset();
  finish.profile.mockReset();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  vi.stubEnv("VOSSIE_BACKEND", "supabase");
  vi.stubEnv("VOSSIE_AUTH_HMAC_KEY", "k".repeat(43) + "=");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

/** Signed in on Supabase: the verified claims, a profile, and (unless told otherwise) a live session. */
function signedIn({ live = true, seller = false } = {}) {
  supabase.claims = CLAIMS;
  supabase.liveUserId = live ? CLAIMS.userId : null;
  supabase.profiles.set(
    CLAIMS.userId,
    supabaseAccount(CLAIMS.userId, CLAIMS.email, seller ? { seller: { slug: "tech-corner", status: "approved" } as never } : {}),
  );
}

/** A form post from `origin` (a stand-in, since jsdom's FormData can't be a real Request's body). */
function posted(fields: Record<string, string> = {}, origin: string | null = "http://localhost:3204") {
  const headers = new Headers({ host: "localhost:3204" });
  if (origin) headers.set("origin", origin);
  let read = false;
  const stand = {
    headers,
    formData: async () => {
      read = true;
      return form(fields);
    },
  } as unknown as Request;
  return { stand, wasRead: () => read };
}

const answer = (response: Response) => [response.status, response.headers.get("location"), response.headers.get("cache-control")];

describe("POST /logout on Supabase (phase B, Task 7)", () => {
  it("signs this browser out with Supabase, leaves the toast and answers 303 to /", async () => {
    signedIn();
    expect(answer(await logoutPost(posted().stand))).toEqual([303, "/", "no-store"]);
    expect(supabase.calls).toContain("signOutHere");
    expect(supabase.calls).toContain("clearSessionFormStates:session-1");
    expect(request.sent.get(FLASH_COOKIE)?.value).toBe("signed-out");
    expect(request.sent.has(SESSION_COOKIE)).toBe(false);
  });

  it("refuses a post from another site with 403, signing nobody out", async () => {
    signedIn();
    const { stand, wasRead } = posted({}, "https://evil.example");
    expect((await logoutPost(stand)).status).toBe(403);
    expect(wasRead()).toBe(false);
    expect(supabase.calls).not.toContain("signOutHere");
    expect(request.sent.size).toBe(0);
  });
});

describe("POST /account/privacy/delete on Supabase (phase B, Task 7; decision 8)", () => {
  it("sends a session ended elsewhere to sign in, deleting nothing, even while its access token's hour runs", async () => {
    signedIn({ live: false });
    expect(answer(await deletePost(posted({ confirm: "yes" }).stand))).toEqual([303, "/login?next=%2Faccount%2Fprivacy", "no-store"]);
    expect(twin.deleteAccountData).not.toHaveBeenCalled();
    expect(request.sent.size).toBe(0);
  });

  it("sends a signed-out visitor to sign in, asking Supabase nothing more", async () => {
    expect(answer(await deletePost(posted({ confirm: "yes" }).stand))).toEqual([303, "/login?next=%2Faccount%2Fprivacy", "no-store"]);
    expect(supabase.calls).not.toContain("liveUserId");
    expect(twin.deleteAccountData).not.toHaveBeenCalled();
  });

  it("asks for the box first, deleting nothing, with the error in the form's state", async () => {
    signedIn();
    expect(answer(await deletePost(posted().stand))).toEqual([303, PAGE, "no-store"]);
    expect(twin.saved).toMatchObject([{ form: "delete-account", sessionKey: "session-1", errors: ["confirm-missing"] }]);
    expect(twin.deleteAccountData).not.toHaveBeenCalled();
    expect(request.revalidatedTags).toEqual([]);
  });

  it("deletes the account, expires the tags, clears the vossie_auth cookies (not vossie_session) and answers 303 to /", async () => {
    signedIn({ seller: true });
    expect(answer(await deletePost(posted({ confirm: "yes" }).stand))).toEqual([303, "/", "no-store"]);
    expect(twin.deleteAccountData).toHaveBeenCalledWith(CLAIMS.userId);
    expect(supabase.calls.indexOf("liveUserId")).toBeLessThan(supabase.calls.indexOf("clearAuthCookies"));
    expect(request.revalidatedTags?.map((entry) => entry.tag)).toEqual(["sellers", "hub", "requests"]);
    expect(request.sent.get(FLASH_COOKIE)?.value).toBe("deleted");
    expect(request.sent.has(SESSION_COOKIE)).toBe(false);
    expect(supabase.claims).toBeNull();
  });

  it("keeps the session and says so when the deletion fails, expiring nothing", async () => {
    signedIn();
    twin.deleteAccountData.mockRejectedValue(new Error("forget_account failed (57014)"));
    expect(answer(await deletePost(posted({ confirm: "yes" }).stand))).toEqual([303, PAGE, "no-store"]);
    expect(twin.saved).toMatchObject([{ form: "delete-account", errors: ["delete-failed"] }]);
    expect(supabase.calls).not.toContain("clearAuthCookies");
    expect(supabase.claims).toEqual(CLAIMS);
    expect(request.revalidatedTags).toEqual([]);
    expect(request.sent.has(FLASH_COOKIE)).toBe(false);
  });
});

describe("GET /account/privacy/export on Supabase (phase B, Task 7)", () => {
  it("gives the sessions from Supabase with their dates only, and asks browsers and hosts to keep no copy", async () => {
    signedIn();
    twin.sessions = [
      { key: "", accountId: CLAIMS.userId, createdAt: "2026-10-20T07:00:00.000Z", expiresAt: "2026-11-20T07:30:00.000Z" },
    ];
    const response = await exportGet();
    expect(response.headers.get("cache-control")).toBe("no-store");
    const body = await response.text();
    const data = JSON.parse(body);
    expect(data.account.email).toBe("thandi@vossie.net");
    expect(data.consents).toHaveLength(1);
    expect(data.sessions).toEqual([{ signedInAt: "2026-10-20T07:00:00.000Z", expiresAt: "2026-11-20T07:30:00.000Z" }]);
    expect(body).not.toContain("session-1");
  });
});

describe("the sign-in posts on Supabase (phase B, Task 7)", () => {
  it("passes step 2 and step 3 through to finishCode and finishProfile, and answers 303 to where they lead", async () => {
    finish.code.mockResolvedValue("/account");
    finish.profile.mockResolvedValue("/sell");
    expect(answer(await codePost(posted({ code: "123456" }).stand))).toEqual([303, "/account", "no-store"]);
    expect(answer(await profilePost(posted({ firstName: "Thandi" }).stand))).toEqual([303, "/sell", "no-store"]);
    expect(finish.code).toHaveBeenCalledTimes(1);
    expect(finish.profile).toHaveBeenCalledTimes(1);
  });

  it("signs nobody in from a sample button: 303 to /login", async () => {
    expect(answer(await samplePost(posted({ email: "student@vossie.test" }).stand))).toEqual([303, "/login", "no-store"]);
    expect(supabase.calls).toEqual([]);
    expect(request.sent.has(SESSION_COOKIE)).toBe(false);
  });
});
