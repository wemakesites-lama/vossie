import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SESSION_COOKIE } from "@/lib/auth/cookies";
import { hashToken } from "@/lib/auth/secrets";
import { createSession } from "@/lib/data/sessions";
import { resetSampleStore } from "@/lib/data/store";
import { resetRequest, type FakeRequest } from "@/tests/helpers/next-request";
import { issueOnceToken, leaveOnceToken, ONCE_TTL_MS, sentOnceToken, takeOnceToken, tokenTakenInSql } from "./once";

const request = vi.hoisted((): FakeRequest => ({ cookies: new Map(), sent: new Map(), proto: "http" }));
/** Each time the page waited for the request (connection()). */
const events = vi.hoisted((): string[] => []);

vi.mock("next/headers", async () => (await import("@/tests/helpers/next-request")).nextHeaders(request));
vi.mock("next/navigation", async () => (await import("@/tests/helpers/next-request")).nextNavigation());
vi.mock("next/server", () => ({
  connection: async () => {
    events.push("connection");
  },
}));

const NOW = new Date("2026-10-14T08:42:00.000Z");
const SENT = { path: "/hub/manage", notice: "post-published" } as const;

beforeEach(async () => {
  resetSampleStore();
  resetRequest(request);
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  await createSession({
    key: hashToken("token-1"),
    accountId: "acc-mentor",
    createdAt: NOW,
    expiresAt: new Date("2026-11-13T08:42:00.000Z"),
  });
  request.cookies.set(SESSION_COOKIE, "token-1");
});

// The same one-time token as selling's new listing (selling plan amendment 14.1), for a new Hub post, a note and a
// check-in (staff tools plan amendment 15.7).
describe("a staff form's one-time token (staff tools plan amendment 15.7)", () => {
  it("is different every time", async () => {
    const first = await issueOnceToken();
    const second = await issueOnceToken();
    expect(first).toMatch(/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/);
    expect(second).not.toBe(first);
  });

  it("is made at request time: the page waits for the request, and the random value comes after that", async () => {
    events.length = 0;
    await issueOnceToken();
    expect(events).toEqual(["connection"]);
    // A mock of a Node builtin never reaches the source in jsdom (see lib/auth/secrets.test.ts), so the order is read
    // from the source.
    const source = readFileSync(join(process.cwd(), "lib/staff/once.ts"), "utf8");
    const body = source.slice(source.indexOf("export async function issueOnceToken"));
    expect(body.indexOf("await connection()")).toBeGreaterThan(-1);
    expect(body.indexOf("await connection()")).toBeLessThan(body.indexOf("randomUUID()"));
  });

  it("is kept for this session for an hour, and the first to take it is first", async () => {
    const token = (await issueOnceToken())!;
    expect(await takeOnceToken(token, new Date(NOW.getTime() + ONCE_TTL_MS - 1))).toEqual({ kind: "first" });
    const other = (await issueOnceToken())!;
    expect(await takeOnceToken(other, new Date(NOW.getTime() + ONCE_TTL_MS))).toEqual({ kind: "none" });
  });

  it("makes none when nobody is signed in", async () => {
    resetRequest(request);
    expect(await issueOnceToken()).toBeNull();
  });

  it("is taken once: later takers are told it was taken, and where that save went once it's said", async () => {
    const token = (await issueOnceToken())!;
    expect(await sentOnceToken(token, NOW)).toBeNull();
    expect(await takeOnceToken(token, NOW)).toEqual({ kind: "first" });
    // Taken, and the save still going on: nothing to say yet.
    expect(await takeOnceToken(token, NOW)).toEqual({ kind: "again", sent: null });
    expect(await sentOnceToken(token, NOW)).toBeNull();
    await leaveOnceToken(token, SENT, NOW);
    expect(await takeOnceToken(token, NOW)).toEqual({ kind: "again", sent: SENT });
    expect(await sentOnceToken(token, NOW)).toEqual(SENT);
  });

  it("keeps where the save went for an hour from when it's said, not from when the form was made", async () => {
    const token = (await issueOnceToken())!;
    await takeOnceToken(token, NOW);
    const later = new Date(NOW.getTime() + ONCE_TTL_MS - 1);
    await leaveOnceToken(token, SENT, later);
    expect(await sentOnceToken(token, new Date(later.getTime() + ONCE_TTL_MS - 1))).toEqual(SENT);
    expect(await sentOnceToken(token, new Date(later.getTime() + ONCE_TTL_MS))).toBeNull();
  });

  it("finds nothing for a made-up token, a badly shaped one, an empty one, or another session's", async () => {
    const token = (await issueOnceToken())!;
    const forged = "00000000-0000-4000-8000-000000000000";
    for (const wrong of [forged, "", "x".repeat(1_000_000), `${token}:extra`, token.toUpperCase()]) {
      expect(await takeOnceToken(wrong, NOW), wrong.slice(0, 20)).toEqual({ kind: "none" });
      expect(await sentOnceToken(wrong, NOW)).toBeNull();
    }
    await createSession({
      key: hashToken("token-2"),
      accountId: "acc-admin",
      createdAt: NOW,
      expiresAt: new Date("2026-11-13T08:42:00.000Z"),
    });
    request.cookies.set(SESSION_COOKIE, "token-2");
    expect(await takeOnceToken(token, NOW)).toEqual({ kind: "none" });
    // Nothing above took it from its own session.
    request.cookies.set(SESSION_COOKIE, "token-1");
    expect(await takeOnceToken(token, NOW)).toEqual({ kind: "first" });
  });

  it("finds nothing, and says nothing, when signed out", async () => {
    const token = (await issueOnceToken())!;
    resetRequest(request);
    expect(await takeOnceToken(token, NOW)).toEqual({ kind: "none" });
    expect(await sentOnceToken(token, NOW)).toBeNull();
    await leaveOnceToken(token, SENT, NOW);
    request.cookies.set(SESSION_COOKIE, "token-1");
    expect(await sentOnceToken(token, NOW)).toBeNull();
  });
});

// On Supabase, five functions take the token in the same transaction as their write (save_request, save_hub_post,
// add_mentor_note, add_check_in, give_role), so their actions don't take it first (C4/C5 plan decision 6).
describe("tokenTakenInSql (C4/C5 plan decision 6)", () => {
  it("is false on the sample store and true on Supabase", () => {
    vi.stubEnv("VOSSIE_BACKEND", "");
    expect(tokenTakenInSql()).toBe(false);
    vi.stubEnv("VOSSIE_BACKEND", "supabase");
    expect(tokenTakenInSql()).toBe(true);
    vi.unstubAllEnvs();
  });
});
