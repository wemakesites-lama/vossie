import type { SampleEmailRow, SignInAttemptRow } from "./rows";
import { sampleStore } from "./store";

// Sign-in attempts, the code count and sample mode's outbox (accounts spec 2.2, 2.3 and 5).

const HOUR_MS = 60 * 60 * 1000;

/** The attempt with this key, while it hasn't run out. A copy: change it, then save it. */
export async function getSignInAttempt(key: string, now: Date): Promise<SignInAttemptRow | null> {
  const row = sampleStore().signInAttempts.get(key);
  return row && Date.parse(row.expiresAt) > now.getTime() ? structuredClone(row) : null;
}

/** Saves an attempt, new or changed, and tidies away ones that have run out, with their sample emails. */
export async function saveSignInAttempt(attempt: SignInAttemptRow, now: Date): Promise<void> {
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
  const store = sampleStore();
  store.signInAttempts.delete(key);
  store.sampleEmails.delete(key);
}

/** How many codes went to `email` in the hour before `now` (spec 5). */
export async function countCodesSent(email: string, now: Date): Promise<number> {
  const since = now.getTime() - HOUR_MS;
  return (sampleStore().codeSends.get(email) ?? []).filter((at) => Date.parse(at) > since).length;
}

/** Notes a code sent to `email`, forgetting sends more than an hour old. */
export async function recordCodeSent(email: string, now: Date): Promise<void> {
  const { codeSends } = sampleStore();
  const since = now.getTime() - HOUR_MS;
  const recent = (codeSends.get(email) ?? []).filter((at) => Date.parse(at) > since);
  codeSends.set(email, [...recent, now.toISOString()]);
}

/** Sample mode's outbox (spec 2.3, plan decision 5): keeps the last code "sent" for an attempt. */
export async function saveSampleEmail(email: SampleEmailRow): Promise<void> {
  sampleStore().sampleEmails.set(email.attemptKey, { ...email });
}

export async function getSampleEmail(attemptKey: string): Promise<SampleEmailRow | null> {
  const row = sampleStore().sampleEmails.get(attemptKey);
  return row ? { ...row } : null;
}
