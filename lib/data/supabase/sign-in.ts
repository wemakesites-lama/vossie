import "server-only";
import type { Json } from "@/lib/supabase/database.types";
import type * as Sample from "../sign-in";
import type { SignInAttemptRow } from "../rows";
import { forServer } from "./clients";
import { iso } from "./rows";

// Sign-in attempts and the code count on Supabase (phase B, Task 4; decision 2). The tables are private, so the admin
// client reaches them through the service-role functions of the phase B migration. Supabase Auth makes, emails and
// checks the code, so an attempt holds no code hash, and there's no sample outbox. Times come from the database's
// clock: `now` is the sample store's, and the hourly sweep (private.sweep_sign_in) tidies attempts that have run out.

function failed(fn: string, error: { code?: string } | null): never {
  throw new Error(`${fn} failed (${error?.code ?? "unknown"})`);
}

/** get_sign_in_attempt's JSON as the app's row, its times in the app's ISO form. */
function toAttempt(json: Json): SignInAttemptRow {
  const row = json as unknown as SignInAttemptRow;
  return {
    key: row.key,
    step: row.step,
    email: row.email,
    errors: [...row.errors],
    resent: row.resent,
    codeHash: null,
    codeExpiresAt: iso(row.codeExpiresAt),
    wrongTries: row.wrongTries,
    consentedAt: iso(row.consentedAt),
    firstName: row.firstName,
    campusSlug: row.campusSlug,
    postedAt: iso(row.postedAt),
    expiresAt: iso(row.expiresAt),
  };
}

export const getSignInAttempt: typeof Sample.getSignInAttempt = async (key) => {
  const { data, error } = await forServer().rpc("get_sign_in_attempt", { p_key: key });
  if (error) failed("get_sign_in_attempt", error);
  return data === null ? null : toAttempt(data);
};

/** Saves the attempt; the database never lowers its try count except for a new code, and keeps a lockout (amendment 2). */
export const saveSignInAttempt: typeof Sample.saveSignInAttempt = async (attempt) => {
  const { error } = await forServer().rpc("save_sign_in_attempt", {
    p_attempt: { ...attempt, codeHash: null } as unknown as Json,
  });
  if (error) failed("save_sign_in_attempt", error);
};

export const deleteSignInAttempt: typeof Sample.deleteSignInAttempt = async (key) => {
  const { error } = await forServer().rpc("delete_sign_in_attempt", { p_key: key });
  if (error) failed("delete_sign_in_attempt", error);
};

/**
 * Counts a try in one statement, before Supabase sees the code (decision 2). 0, as in the sample store, when the attempt
 * has gone: a real count is at least 1, and the caller treats 0 as "no attempt" and sends nothing to Supabase
 * (amendment 2: a gone attempt never lets a try through uncounted).
 */
export const recordWrongTry: typeof Sample.recordWrongTry = async (attemptKey) => {
  const { data, error } = await forServer().rpc("record_wrong_try", { p_attempt_key: attemptKey });
  if (error) failed("record_wrong_try", error);
  return data ?? 0;
};

/** One of the hour's codes for `email`, counted per UTC hour on the database's clock (phase A's change). */
export const reserveCodeSend: typeof Sample.reserveCodeSend = async (email, _now, limit) => {
  const { data, error } = await forServer().rpc("reserve_code_send", { p_email: email, p_max_sends: limit });
  if (error) failed("reserve_code_send", error);
  return data === true;
};

/** One of the hour's codes for a network (review fix 2), counted per UTC hour on the database's clock. */
export const reserveIpSend: typeof Sample.reserveIpSend = async (ipKey, _now, limit) => {
  const { data, error } = await forServer().rpc("reserve_ip_code_send", { p_ip_key: ipKey, p_max_sends: limit });
  if (error) failed("reserve_ip_code_send", error);
  return data === true;
};

export const countCodesSent: typeof Sample.countCodesSent = async () => {
  throw new Error("countCodesSent() is test-only on the sample store");
};

export const recordCodeSent: typeof Sample.recordCodeSent = async () => {
  throw new Error("recordCodeSent() is test-only on the sample store");
};

export const saveSampleEmail: typeof Sample.saveSampleEmail = async () => {
  throw new Error("Supabase has no sample outbox: Supabase Auth emails the code");
};

export const getSampleEmail: typeof Sample.getSampleEmail = async () => null;
