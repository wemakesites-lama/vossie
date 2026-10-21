import "server-only";
import type { Json } from "@/lib/supabase/database.types";
import type * as Sample from "../form-states";
import type { FormStateRow } from "../rows";
import { currentClaims } from "./auth-session";
import { forViewer } from "./clients";
import { iso } from "./rows";

// Signed-in forms' states on Supabase (phase B, Task 4; decision 15, amendment 8): the viewer's own rows, through the
// viewer's client, one per Auth session and form. The table's access rule checks the account and the JWT's
// session_id, so another browser never sees this one's. `taken` is the database's: a trigger keeps it once set.

const COLUMNS = "session_id, form, errors, values, notice, expires_at, taken";

function failed(error: { code?: string }): never {
  throw new Error(`form_states failed (${error.code ?? "unknown"})`);
}

export const getFormState: typeof Sample.getFormState = async (sessionKey, form, now) => {
  const { data, error } = await (await forViewer())
    .from("form_states")
    .select(COLUMNS)
    .eq("session_id", sessionKey)
    .eq("form", form)
    .gt("expires_at", now.toISOString())
    .maybeSingle();
  if (error) failed(error);
  if (!data) return null;
  const row: FormStateRow = {
    key: `${data.session_id}:${data.form}`,
    sessionKey: data.session_id,
    form: data.form,
    errors: [...data.errors],
    values: data.values as Record<string, string>,
    notice: data.notice,
    expiresAt: iso(data.expires_at),
  };
  if (data.taken) row.taken = true;
  return row;
};

/** Saves the state as the signed-in account's, replacing the last. Signed out, there's nobody to save it for. */
export const saveFormState: typeof Sample.saveFormState = async (state) => {
  const claims = await currentClaims();
  if (!claims) throw new Error("saveFormState() signed out");
  const { error } = await (await forViewer()).from("form_states").upsert(
    {
      session_id: state.sessionKey,
      form: state.form,
      account_id: claims.userId,
      errors: [...state.errors],
      values: state.values as NonNullable<Json>,
      notice: state.notice,
      expires_at: state.expiresAt,
    },
    { onConflict: "session_id,form" },
  );
  if (error) failed(error);
};

export const clearFormState: typeof Sample.clearFormState = async (sessionKey, form) => {
  const { error } = await (await forViewer()).from("form_states").delete().eq("session_id", sessionKey).eq("form", form);
  if (error) failed(error);
};

/**
 * Takes one of this session's one-time tokens (C4/C5 plan Task 2, decision 6): take_form_state (C2/C3's,
 * 20261022120000_c2_selling.sql) checks and marks the row of the JWT's session under its lock, in one call, for a
 * new listing's "listing-once:" token and save this search's "staff-once:" one; the five functions that take their own
 * token never come here. The row is then read back, so a later post finds where the first one went. The key must be
 * the signed-in session's (2b decision 20: the session, not an argument, says whose).
 */
export const takeFormState: typeof Sample.takeFormState = async (sessionKey, form, now) => {
  const claims = await currentClaims();
  if (!claims || claims.sessionId !== sessionKey) throw new Error("takeFormState: not the signed-in session");
  const { data, error } = await (await forViewer()).rpc("take_form_state", { p_key: form });
  if (error) failed(error);
  if (data !== "first" && data !== "again") return null;
  const state = await getFormState(sessionKey, form, now);
  return state ? { first: data === "first", state } : null;
};

/**
 * This session's states, at sign-out. A taken one-time token can't be deleted while it lasts (its trigger), and one
 * such row would abort the whole delete, so those stay: they run out within the hour and the hourly sweep takes them
 * (amendment 8).
 */
export const clearSessionFormStates: typeof Sample.clearSessionFormStates = async (sessionId) => {
  const { error } = await (await forViewer()).from("form_states").delete().eq("session_id", sessionId).eq("taken", false);
  if (error) failed(error);
};
