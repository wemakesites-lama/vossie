import { onSupabase } from "@/lib/backend";
import type { SampleEmailRow, SignInAttemptRow } from "./rows";
import { type SampleStore, sampleStore } from "./store";

// Sign-in attempts, the code count and sample mode's outbox (accounts spec 2.2, 2.3 and 5).

const HOUR_MS = 60 * 60 * 1000;

/** The attempt with this key, while it hasn't run out. A copy: change it, then save it. */
export async function getSignInAttempt(key: string, now: Date): Promise<SignInAttemptRow | null> {
  if (onSupabase()) return (await import("./supabase/sign-in")).getSignInAttempt(key, now);
  const row = sampleStore().signInAttempts.get(key);
  return row && Date.parse(row.expiresAt) > now.getTime() ? structuredClone(row) : null;
}

/** Saves an attempt, new or changed, and tidies away ones that have run out, with their sample emails. */
export async function saveSignInAttempt(attempt: SignInAttemptRow, now: Date): Promise<void> {
  if (onSupabase()) return (await import("./supabase/sign-in")).saveSignInAttempt(attempt, now);
  const store = sampleStore();
  for (const [key, row] of store.signInAttempts) {
    if (Date.parse(row.expiresAt) > now.getTime()) continue;
    store.signInAttempts.delete(key);
    store.sampleEmails.delete(key);
  }
  store.signInAttempts.set(attempt.key, structuredClone(attempt));
}

/** Ends an attempt: it and its sample email go. */
export async function deleteSignInAttempt(key: string): Promise<void> {
  if (onSupabase()) return (await import("./supabase/sign-in")).deleteSignInAttempt(key);
  const store = sampleStore();
  store.signInAttempts.delete(key);
  store.sampleEmails.delete(key);
}

/**
 * Counts one wrong try against the attempt and gives the new count (spec 2.2). 0 when the attempt has gone.
 *
 * This is one step, not a read, a change and a write of the whole row: two posts at once each get their own count, so
 * neither can undo the other's try and slip past the lockout. Here nothing awaits between the read and the change,
 * which is what makes it one step. The real backend must make it atomic too, for instance with one statement:
 * `UPDATE sign_in_attempts SET wrong_tries = wrong_tries + 1 WHERE key = $1 RETURNING wrong_tries`.
 */
export async function recordWrongTry(attemptKey: string): Promise<number> {
  if (onSupabase()) return (await import("./supabase/sign-in")).recordWrongTry(attemptKey);
  const row = sampleStore().signInAttempts.get(attemptKey);
  if (!row) return 0;
  row.wrongTries += 1;
  return row.wrongTries;
}

/** The sends to `email` in the hour before `now`. */
function sendsInLastHour(store: SampleStore, email: string, now: Date): string[] {
  const since = now.getTime() - HOUR_MS;
  return (store.codeSends.get(email) ?? []).filter((at) => Date.parse(at) > since);
}

/** Writes down a send to `email`, and forgets every email's sends more than an hour old (they no longer count). */
function noteSend(store: SampleStore, email: string, now: Date): void {
  for (const other of [...store.codeSends.keys()]) {
    const recent = sendsInLastHour(store, other, now);
    if (recent.length === 0) store.codeSends.delete(other);
    else store.codeSends.set(other, recent);
  }
  store.codeSends.set(email, [...(store.codeSends.get(email) ?? []), now.toISOString()]);
}

/**
 * Asks to send a code to `email` (spec 5): counts the sends in the hour before `now` and, only if they are under
 * `limit`, records this one and says yes. Otherwise nothing is recorded and it says no.
 *
 * Counting and recording are one step, so posts at once can't each count "under the limit" and all send. Here nothing
 * awaits between the two, which is what makes it one step. The real backend must make it atomic too, and a count
 * followed by an insert is not enough: use a single upsert on a per-email counter row
 * (`INSERT … ON CONFLICT (email, hour) DO UPDATE SET n = n + 1 WHERE n < $limit RETURNING n`, no row back meaning "no"),
 * or a transaction that holds a per-email lock while it counts and inserts.
 */
export async function reserveCodeSend(email: string, now: Date, limit: number): Promise<boolean> {
  if (onSupabase()) return (await import("./supabase/sign-in")).reserveCodeSend(email, now, limit);
  const store = sampleStore();
  if (sendsInLastHour(store, email, now).length >= limit) return false;
  noteSend(store, email, now);
  return true;
}

/**
 * How many codes went to `email` in the hour before `now` (spec 5). A read for tests and tools. The sign-in actions
 * don't count and then record: they call reserveCodeSend, which does both in one step.
 */
export async function countCodesSent(email: string, now: Date): Promise<number> {
  if (onSupabase()) return (await import("./supabase/sign-in")).countCodesSent(email, now);
  return sendsInLastHour(sampleStore(), email, now).length;
}

/**
 * Notes a code sent to `email`, and forgets every email's sends more than an hour old. It doesn't check a limit: the
 * sign-in actions call reserveCodeSend, which does. Kept for tests that need sends already on record.
 */
export async function recordCodeSent(email: string, now: Date): Promise<void> {
  if (onSupabase()) return (await import("./supabase/sign-in")).recordCodeSent(email, now);
  noteSend(sampleStore(), email, now);
}

/** Sample mode's outbox (spec 2.3, plan decision 5): keeps the last code "sent" for an attempt. */
export async function saveSampleEmail(email: SampleEmailRow): Promise<void> {
  if (onSupabase()) return (await import("./supabase/sign-in")).saveSampleEmail(email);
  sampleStore().sampleEmails.set(email.attemptKey, { ...email });
}

export async function getSampleEmail(attemptKey: string): Promise<SampleEmailRow | null> {
  if (onSupabase()) return (await import("./supabase/sign-in")).getSampleEmail(attemptKey);
  const row = sampleStore().sampleEmails.get(attemptKey);
  return row ? { ...row } : null;
}
