import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeSupabase } from "@/tests/helpers/fake-supabase";
import { createSession, deleteSession, findSessionAccountId, listSessions } from "./sessions";

// Sessions on Supabase (phase B, Task 4; amendment 10): Supabase Auth keeps them; the data download lists them.

vi.mock("server-only", () => ({}));
const seam = vi.hoisted(() => ({ server: null as unknown }));
vi.mock("./clients", () => ({ forServer: () => seam.server }));

let db: ReturnType<typeof fakeSupabase>;
beforeEach(() => {
  db = fakeSupabase();
  seam.server = db.client;
});

describe("sessions on Supabase", () => {
  it("lists an account's sessions through account_sessions, with no key or id", async () => {
    db.answer("rpc:account_sessions", {
      data: [
        { signed_in_at: "2026-10-01T08:00:00+00:00", expires_at: "2026-11-19T06:30:00+00:00" },
        { signed_in_at: "2026-10-10T08:00:00+00:00", expires_at: "2026-11-11T08:00:00+00:00" },
      ],
    });
    expect(await listSessions("user-1")).toEqual([
      { key: "", accountId: "user-1", createdAt: "2026-10-01T08:00:00.000Z", expiresAt: "2026-11-19T06:30:00.000Z" },
      { key: "", accountId: "user-1", createdAt: "2026-10-10T08:00:00.000Z", expiresAt: "2026-11-11T08:00:00.000Z" },
    ]);
    expect(db.calls).toEqual([["rpc", "account_sessions", { p_account: "user-1" }]]);
  });

  it("throws when the database refuses", async () => {
    db.answer("rpc:account_sessions", { error: { code: "42501", message: "permission denied" } });
    await expect(listSessions("user-1")).rejects.toThrow("account_sessions failed (42501)");
  });

  it("never makes, finds or deletes a session itself: Supabase Auth keeps them", async () => {
    const now = new Date("2026-10-21T10:00:00.000Z");
    await expect(createSession({ key: "k", accountId: "a", createdAt: now, expiresAt: now })).rejects.toThrow(
      "Supabase Auth keeps sessions",
    );
    await expect(findSessionAccountId("k", now)).rejects.toThrow("Supabase Auth keeps sessions");
    await expect(deleteSession("k")).rejects.toThrow("Supabase Auth keeps sessions");
    expect(db.calls).toEqual([]);
  });
});
