import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeSupabase } from "@/tests/helpers/fake-supabase";
import { clearFormState, clearSessionFormStates, getFormState, saveFormState, takeFormState } from "./form-states";

// Form states on Supabase (phase B, Task 4; decision 15, amendment 8): the viewer's own rows, one per session and form,
// which the table's access rule checks against the account and the JWT's session_id.

vi.mock("server-only", () => ({}));
const seam = vi.hoisted(() => ({
  viewer: null as unknown,
  claims: null as null | { userId: string; sessionId: string; email: string },
}));
vi.mock("./clients", () => ({ forViewer: async () => seam.viewer }));
vi.mock("./auth-session", () => ({ currentClaims: async () => seam.claims }));

const NOW = new Date("2026-10-21T10:00:00.000Z");
let db: ReturnType<typeof fakeSupabase>;

beforeEach(() => {
  db = fakeSupabase();
  seam.viewer = db.client;
  seam.claims = { userId: "user-1", sessionId: "session-1", email: "thandi@vossie.net" };
});

describe("form states on Supabase", () => {
  it("reads this session's state for a form while it lasts", async () => {
    db.answer("from:form_states", {
      data: {
        session_id: "session-1",
        form: "details",
        errors: ["first-name-missing"],
        values: { firstName: "T" },
        notice: null,
        expires_at: "2026-10-21T10:10:00+00:00",
        taken: false,
      },
    });
    expect(await getFormState("session-1", "details", NOW)).toEqual({
      key: "session-1:details",
      sessionKey: "session-1",
      form: "details",
      errors: ["first-name-missing"],
      values: { firstName: "T" },
      notice: null,
      expiresAt: "2026-10-21T10:10:00.000Z",
    });
    expect(db.chainOf("from", "form_states")).toEqual([
      ["from", "form_states"],
      ["select", "session_id, form, errors, values, notice, expires_at, taken"],
      ["eq", "session_id", "session-1"],
      ["eq", "form", "details"],
      ["gt", "expires_at", NOW.toISOString()],
      ["maybeSingle"],
    ]);
  });

  it("marks a taken one, and is null when there's none", async () => {
    db.answer(
      "from:form_states",
      {
        data: {
          session_id: "s",
          form: "f",
          errors: [],
          values: {},
          notice: null,
          expires_at: "2026-10-21T10:10:00Z",
          taken: true,
        },
      },
      { data: null },
    );
    expect((await getFormState("s", "f", NOW))?.taken).toBe(true);
    expect(await getFormState("s", "f", NOW)).toBeNull();
  });

  it("saves the state as the signed-in account's, replacing the last, leaving taken to the database", async () => {
    await saveFormState(
      { sessionKey: "session-1", form: "details", errors: [], values: {}, notice: "saved", expiresAt: "2026-10-21T10:10:00.000Z" },
      NOW,
    );
    expect(db.chainOf("from", "form_states")).toEqual([
      ["from", "form_states"],
      [
        "upsert",
        {
          session_id: "session-1",
          form: "details",
          account_id: "user-1",
          errors: [],
          values: {},
          notice: "saved",
          expires_at: "2026-10-21T10:10:00.000Z",
        },
        { onConflict: "session_id,form" },
      ],
    ]);
  });

  it("saves nothing signed out", async () => {
    seam.claims = null;
    await expect(
      saveFormState({ sessionKey: "s", form: "f", errors: [], values: {}, notice: null, expiresAt: NOW.toISOString() }, NOW),
    ).rejects.toThrow("signed out");
    expect(db.calls).toEqual([]);
  });

  it("clears one form's state", async () => {
    await clearFormState("session-1", "details");
    expect(db.chainOf("from", "form_states")).toEqual([
      ["from", "form_states"],
      ["delete"],
      ["eq", "session_id", "session-1"],
      ["eq", "form", "details"],
    ]);
  });

  it("clears this session's states at sign-out, leaving taken tokens to run out (amendment 8)", async () => {
    await clearSessionFormStates("session-1");
    expect(db.chainOf("from", "form_states")).toEqual([
      ["from", "form_states"],
      ["delete"],
      ["eq", "session_id", "session-1"],
      ["eq", "taken", false],
    ]);
  });

  it("leaves taking a one-time state to SQL (decision 15)", async () => {
    await expect(takeFormState("s", "f", NOW)).rejects.toThrow("takeFormState runs in SQL on Supabase (phase C)");
  });

  it("throws when the database refuses", async () => {
    db.answer("from:form_states", { error: { code: "42501", message: "denied" } });
    await expect(clearFormState("s", "f")).rejects.toThrow("form_states failed (42501)");
  });
});
