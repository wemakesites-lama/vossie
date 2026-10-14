import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSession } from "@/lib/data/sessions";
import { resetSampleStore, sampleStore } from "@/lib/data/store";
import { redirectOf, resetRequest, type FakeRequest } from "@/tests/helpers/next-request";
import { SESSION_COOKIE } from "./cookies";
import { hashToken } from "./secrets";
import { endSession, getSessionKey, getViewer, requireAccount, startSession } from "./session";

const request = vi.hoisted((): FakeRequest => ({ cookies: new Map(), sent: new Map(), proto: "http" }));

vi.mock("next/headers", async () => (await import("@/tests/helpers/next-request")).nextHeaders(request));
vi.mock("next/navigation", async () => (await import("@/tests/helpers/next-request")).nextNavigation());
vi.mock("next/server", async () => (await import("@/tests/helpers/next-request")).nextServer());

const NOW = new Date("2026-10-14T08:42:00.000Z");
const IN_30_DAYS = new Date("2026-11-13T08:42:00.000Z");

beforeEach(() => {
  resetSampleStore();
  resetRequest(request);
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

/** A stored session for `accountId`, and its token in the browser's cookie. */
async function signedInAs(accountId: string, expiresAt = IN_30_DAYS) {
  await createSession({ key: hashToken("token-1"), accountId, createdAt: NOW, expiresAt });
  request.cookies.set(SESSION_COOKIE, "token-1");
}

describe("getViewer (accounts spec 2.9)", () => {
  it("is null without a session cookie", async () => {
    expect(await getViewer()).toBeNull();
  });

  it("is the account whose session the cookie names", async () => {
    await signedInAs("acc-student");
    expect(await getViewer()).toMatchObject({ id: "acc-student", firstName: "Thandi", email: "student@eduvos.com" });
  });

  it("is null once the session has run out, and for a token the store doesn't know", async () => {
    await signedInAs("acc-student", new Date("2026-10-14T08:00:00.000Z"));
    expect(await getViewer()).toBeNull();
    request.cookies.set(SESSION_COOKIE, "made-up");
    expect(await getViewer()).toBeNull();
  });

  it("trusts nothing but the session: other cookies saying who you are change nothing (spec 2.5)", async () => {
    request.cookies.set("vossie_signed_in", "1");
    request.cookies.set("vossie_account", "acc-admin");
    expect(await getViewer()).toBeNull();
  });

  it("is null for the session of an account that has been deleted", async () => {
    await signedInAs("acc-student");
    sampleStore().accounts.delete("acc-student");
    expect(await getViewer()).toBeNull();
  });

  it("is null with sample mode off, as there's no backend yet (spec 2.1)", async () => {
    await signedInAs("acc-student");
    vi.stubEnv("VOSSIE_SAMPLE_MODE", "0");
    expect(await getViewer()).toBeNull();
  });
});

describe("requireAccount (accounts spec 2.10)", () => {
  it("gives the signed-in account", async () => {
    await signedInAs("acc-mentor");
    expect((await requireAccount("/account")).id).toBe("acc-mentor");
  });

  it("sends anyone else to sign in, coming back afterwards", async () => {
    expect(await redirectOf(() => requireAccount("/account/privacy"))).toBe("/login?next=%2Faccount%2Fprivacy");
  });
});

describe("starting and ending a session (accounts spec 2.5)", () => {
  it("signs in with a new random token: the browser gets it in an httpOnly cookie, the store only its hash", async () => {
    await startSession("acc-student", NOW);
    const token = request.cookies.get(SESSION_COOKIE)!;
    expect(token).toMatch(/^[0-9a-f-]{36}$/);
    expect(request.sent.get(SESSION_COOKIE)?.options).toEqual({
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      path: "/",
      maxAge: 2_592_000,
    });
    expect(sampleStore().sessions.has(token)).toBe(false);
    expect(sampleStore().sessions.get(hashToken(token))).toMatchObject({
      accountId: "acc-student",
      createdAt: NOW.toISOString(),
      expiresAt: IN_30_DAYS.toISOString(),
    });
    expect(await getSessionKey()).toBe(hashToken(token));
    expect((await getViewer())?.id).toBe("acc-student");
  });

  it("makes the cookie Secure over HTTPS (plan decision 18)", async () => {
    request.proto = "https";
    await startSession("acc-student", NOW);
    expect(request.sent.get(SESSION_COOKIE)?.options.secure).toBe(true);
  });

  it("replaces the browser's old session rather than keeping both", async () => {
    await signedInAs("acc-student");
    await startSession("acc-admin", NOW);
    expect(sampleStore().sessions.has(hashToken("token-1"))).toBe(false);
    expect([...sampleStore().sessions.values()].map((row) => row.accountId)).toEqual(["acc-admin"]);
  });

  it("signs out: the stored session and the cookie both go", async () => {
    await signedInAs("acc-student");
    await endSession();
    expect(sampleStore().sessions.size).toBe(0);
    expect(request.cookies.has(SESSION_COOKIE)).toBe(false);
    expect(request.sent.get(SESSION_COOKIE)?.options.maxAge).toBe(0);
    expect(await getViewer()).toBeNull();
  });
});
