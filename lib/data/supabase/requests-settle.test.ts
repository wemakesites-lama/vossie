import { beforeEach, describe, expect, it, vi } from "vitest";

// The settle on Supabase, once per request (C4 review fix 4): settle_requests runs through React's cache(), keyed by
// the SAST minute, so a render whose components each settle first (the board, the asker's offers, the composer) calls
// the database once, with the first caller's time. React's cache() memoises only inside a render: a Server Action or a
// Route Handler runs it each time, so an action that writes still settles at its start.
//
// React's own cache() is a pass-through outside the react-server build these tests run in, so the render's scope is
// stood in for here: `render.scope` is a render's memo while it's set, and nothing memoises while it's null.

vi.mock("server-only", () => ({}));
const render = vi.hoisted(() => ({ scope: null as Map<unknown, Map<string, unknown>> | null }));
vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  cache:
    <A extends unknown[], R>(fn: (...args: A) => R) =>
    (...args: A): R => {
      if (!render.scope) return fn(...args);
      const memo = render.scope.get(fn) ?? new Map<string, unknown>();
      render.scope.set(fn, memo);
      const key = JSON.stringify(args);
      if (!memo.has(key)) memo.set(key, fn(...args));
      return memo.get(key) as R;
    },
}));
const db = vi.hoisted(() => ({ calls: [] as { fn: string; args: unknown }[], closed: 0 }));
vi.mock("./clients", () => ({
  forServer: () => ({
    rpc: async (fn: string, args: unknown) => {
      db.calls.push({ fn, args });
      return { data: db.closed, error: null };
    },
  }),
  forPublic: () => {
    throw new Error("not in this test");
  },
  forViewer: async () => {
    throw new Error("not in this test");
  },
}));
vi.mock("./viewer", () => ({
  forViewerAs: async () => {
    throw new Error("not in this test");
  },
}));

const { settleRequests } = await import("./requests");

// 10:15:20 and 10:15:50 SAST are the same minute; 10:16:05 is the next.
const FIRST = new Date("2026-10-21T08:15:20.000Z");
const SAME_MINUTE = new Date("2026-10-21T08:15:50.000Z");
const NEXT_MINUTE = new Date("2026-10-21T08:16:05.000Z");

beforeEach(() => {
  db.calls.length = 0;
  db.closed = 2;
  render.scope = null;
});

describe("settleRequests on Supabase, once per request (C4 review fix 4)", () => {
  it("settles once in a render for the SAST minute, with the first caller's time, and gives each caller its count", async () => {
    render.scope = new Map();
    const counts = await Promise.all([settleRequests(FIRST), settleRequests(SAME_MINUTE), settleRequests(FIRST)]);
    expect(counts).toEqual([2, 2, 2]);
    expect(db.calls).toEqual([{ fn: "settle_requests", args: { p_now: FIRST.toISOString() } }]);
    expect(await settleRequests(SAME_MINUTE)).toBe(2);
    expect(db.calls).toHaveLength(1);
  });

  it("settles again in the next minute, and in the next render", async () => {
    render.scope = new Map();
    await settleRequests(FIRST);
    await settleRequests(NEXT_MINUTE);
    expect(db.calls.map((call) => call.args)).toEqual([{ p_now: FIRST.toISOString() }, { p_now: NEXT_MINUTE.toISOString() }]);
    render.scope = new Map();
    await settleRequests(SAME_MINUTE);
    expect(db.calls).toHaveLength(3);
  });

  it("settles every time outside a render, so a Server Action that writes settles at its start", async () => {
    db.closed = 1;
    expect(await settleRequests(FIRST)).toBe(1);
    db.closed = 0;
    expect(await settleRequests(SAME_MINUTE)).toBe(0);
    expect(db.calls.map((call) => call.args)).toEqual([{ p_now: FIRST.toISOString() }, { p_now: SAME_MINUTE.toISOString() }]);
  });
});
