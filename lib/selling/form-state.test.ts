import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SESSION_COOKIE } from "@/lib/auth/cookies";
import { readFormState, writeFormState } from "@/lib/auth/form-state";
import { hashToken } from "@/lib/auth/secrets";
import { createSession } from "@/lib/data/sessions";
import { resetSampleStore } from "@/lib/data/store";
import { resetRequest, type FakeRequest } from "@/tests/helpers/next-request";
import {
  DASHBOARD_FORM,
  issueListingToken,
  LISTING_TOKEN_TTL_MS,
  leaveListingToken,
  MY_LISTINGS_FORM,
  sentListing,
  takeListingToken,
  takeNotice,
} from "./form-state";

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

beforeEach(async () => {
  resetSampleStore();
  resetRequest(request);
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  await createSession({
    key: hashToken("token-1"),
    accountId: "acc-seller",
    createdAt: NOW,
    expiresAt: new Date("2026-11-13T08:42:00.000Z"),
  });
  request.cookies.set(SESSION_COOKIE, "token-1");
});

describe("selling's notices (amendment 10.6, as messaging takes its \"Sent.\" note)", () => {
  it("shows a notice once: the page takes it as it reads it, and only from its own form", async () => {
    await writeFormState(MY_LISTINGS_FORM, { errors: [], values: { listing: "l-001" }, notice: "paused" }, NOW);
    await writeFormState(DASHBOARD_FORM, { errors: [], values: {}, notice: "shop-resumed" }, NOW);
    expect(await takeNotice(MY_LISTINGS_FORM)).toMatchObject({ notice: "paused", values: { listing: "l-001" } });
    expect(await takeNotice(MY_LISTINGS_FORM)).toBeNull();
    expect(await readFormState(MY_LISTINGS_FORM)).toBeNull();
    // The dashboard's was not taken with it.
    expect(await takeNotice(DASHBOARD_FORM)).toMatchObject({ notice: "shop-resumed" });
    expect(await takeNotice(DASHBOARD_FORM)).toBeNull();
  });

  it("leaves a state that holds no notice alone, and finds nothing when signed out", async () => {
    await writeFormState(DASHBOARD_FORM, { errors: ["x"], values: {}, notice: null }, NOW);
    expect(await takeNotice(DASHBOARD_FORM)).toBeNull();
    expect((await readFormState(DASHBOARD_FORM))?.errors).toEqual(["x"]);
    resetRequest(request);
    expect(await takeNotice(DASHBOARD_FORM)).toBeNull();
  });
});

describe("a new listing's one-time token (selling plan amendment 14.1)", () => {
  const SENT = { path: "/sell/listings", listing: "l-new", notice: "published" } as const;

  it("is different every time", async () => {
    const first = await issueListingToken();
    const second = await issueListingToken();
    expect(first).toMatch(/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/);
    expect(second).not.toBe(first);
  });

  it("is made at request time: the page waits for the request, and the random value comes after that", async () => {
    events.length = 0;
    await issueListingToken();
    expect(events).toEqual(["connection"]);
    // A mock of a Node builtin never reaches the source in jsdom (see lib/auth/secrets.test.ts), so the order is read
    // from the source, as that test reads timingSafeEqual.
    const source = readFileSync(join(process.cwd(), "lib/selling/form-state.ts"), "utf8");
    const body = source.slice(source.indexOf("export async function issueListingToken"));
    expect(body.indexOf("await connection()")).toBeGreaterThan(-1);
    expect(body.indexOf("await connection()")).toBeLessThan(body.indexOf("randomUUID()"));
  });

  it("is kept for this session for an hour, and the first to take it is first", async () => {
    const token = (await issueListingToken())!;
    expect(await takeListingToken(token, new Date(NOW.getTime() + LISTING_TOKEN_TTL_MS - 1))).toEqual({ kind: "first" });
    const other = (await issueListingToken())!;
    expect(await takeListingToken(other, new Date(NOW.getTime() + LISTING_TOKEN_TTL_MS))).toEqual({ kind: "none" });
  });

  it("makes none when nobody is signed in", async () => {
    resetRequest(request);
    expect(await issueListingToken()).toBeNull();
  });

  it("is taken once: later takers are told it was taken, and where that save went once it's said", async () => {
    const token = (await issueListingToken())!;
    expect(await sentListing(token, NOW)).toBeNull();
    expect(await takeListingToken(token, NOW)).toEqual({ kind: "first" });
    // Taken, and the save still going on: nothing to say yet.
    expect(await takeListingToken(token, NOW)).toEqual({ kind: "again", sent: null });
    expect(await sentListing(token, NOW)).toBeNull();
    await leaveListingToken(token, SENT, NOW);
    expect(await takeListingToken(token, NOW)).toEqual({ kind: "again", sent: SENT });
    expect(await sentListing(token, NOW)).toEqual(SENT);
  });

  it("keeps where the save went for an hour from when it's said, not from when the form was made", async () => {
    const token = (await issueListingToken())!;
    await takeListingToken(token, NOW);
    const later = new Date(NOW.getTime() + LISTING_TOKEN_TTL_MS - 1);
    await leaveListingToken(token, SENT, later);
    expect(await sentListing(token, new Date(later.getTime() + LISTING_TOKEN_TTL_MS - 1))).toEqual(SENT);
    expect(await sentListing(token, new Date(later.getTime() + LISTING_TOKEN_TTL_MS))).toBeNull();
  });

  it("finds nothing for a made-up token, a badly shaped one, an empty one, or another session's", async () => {
    const token = (await issueListingToken())!;
    const forged = "00000000-0000-4000-8000-000000000000";
    for (const wrong of [forged, "", "x".repeat(1_000_000), `${token}:extra`, token.toUpperCase()]) {
      expect(await takeListingToken(wrong, NOW), wrong.slice(0, 20)).toEqual({ kind: "none" });
      expect(await sentListing(wrong, NOW)).toBeNull();
    }
    await createSession({
      key: hashToken("token-2"),
      accountId: "acc-seller",
      createdAt: NOW,
      expiresAt: new Date("2026-11-13T08:42:00.000Z"),
    });
    request.cookies.set(SESSION_COOKIE, "token-2");
    expect(await takeListingToken(token, NOW)).toEqual({ kind: "none" });
    // Nothing above took it from its own session.
    request.cookies.set(SESSION_COOKIE, "token-1");
    expect(await takeListingToken(token, NOW)).toEqual({ kind: "first" });
  });

  it("finds nothing, and says nothing, when signed out", async () => {
    const token = (await issueListingToken())!;
    resetRequest(request);
    expect(await takeListingToken(token, NOW)).toEqual({ kind: "none" });
    expect(await sentListing(token, NOW)).toBeNull();
    await leaveListingToken(token, SENT, NOW);
    request.cookies.set(SESSION_COOKIE, "token-1");
    expect(await sentListing(token, NOW)).toBeNull();
  });
});
