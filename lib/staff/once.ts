import { randomUUID } from "node:crypto";
import { connection } from "next/server";
import { getSessionKey } from "@/lib/auth/session";
import { getFormState, saveFormState, takeFormState } from "@/lib/data/form-states";
import type { FormStateRow } from "@/lib/data/rows";

// A staff form is sent once (staff tools plan amendment 15.7), the way selling's new listing is (selling plan
// amendment 14.1, lib/selling/form-state.ts): a new Hub post, a note and a check-in carry a hidden one-time token. It
// is made when the form is drawn, at request time, and kept in form state for the session; the first post to take it
// makes the thing, and any other goes where that one went and makes nothing. Edits need none: an unchanged save changes
// nothing. No client bytes.

/**
 * A token lasts an hour, not form state's usual 10 minutes: a mentor slow over a post shouldn't be turned away at Save.
 * It holds nothing about the person.
 */
export const ONCE_TTL_MS = 60 * 60 * 1000;

const TOKEN_SHAPE = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/;
const onceForm = (token: string) => `staff-once:${token}`;
const expiryFrom = (now: Date) => new Date(now.getTime() + ONCE_TTL_MS).toISOString();

/** Where a form's first save went, and the notice it left (lib/staff/notices.ts), for a repeat to go there too. */
export type OnceSent = { path: string; notice: string };

/**
 * A new token for a staff form, kept for this session; null when nobody is signed in. Request-time: call it inside
 * <Suspense>. The random value is made only after `connection()`, never while prerendering (decision 26).
 */
export async function issueOnceToken(): Promise<string | null> {
  const sessionKey = await getSessionKey();
  if (!sessionKey) return null;
  await connection();
  const now = new Date();
  const token = randomUUID();
  await saveFormState(
    { sessionKey, form: onceForm(token), errors: [], values: {}, notice: null, expiresAt: expiryFrom(now) },
    now,
  );
  return token;
}

function sentFrom(state: FormStateRow): OnceSent | null {
  const { path } = state.values;
  return state.taken && path && state.notice ? { path, notice: state.notice } : null;
}

/** Where the token's save went, once it has been made. Null before then, and for a token this session lacks. */
export async function sentOnceToken(token: string, now: Date): Promise<OnceSent | null> {
  const sessionKey = await getSessionKey();
  if (!sessionKey || !TOKEN_SHAPE.test(token)) return null;
  const state = await getFormState(sessionKey, onceForm(token), now);
  return state ? sentFrom(state) : null;
}

export type Once =
  /** Yours: make the thing, then say where it went with `leaveOnceToken`. */
  | { kind: "first" }
  /** None like it in this session: left out, made up, run out, or another session's. */
  | { kind: "none" }
  /** Taken already. `sent` is where that save went, or null while it is still going. */
  | { kind: "again"; sent: OnceSent | null };

/** Takes the token for this post, if it is the first to. Server Actions only. */
export async function takeOnceToken(token: string, now: Date): Promise<Once> {
  const sessionKey = await getSessionKey();
  const taken = sessionKey && TOKEN_SHAPE.test(token) ? await takeFormState(sessionKey, onceForm(token), now) : null;
  if (!taken) return { kind: "none" };
  return taken.first ? { kind: "first" } : { kind: "again", sent: sentFrom(taken.state) };
}

/** The first post says where it went, for any other that comes with the same token. Server Actions only. */
export async function leaveOnceToken(token: string, sent: OnceSent, now: Date): Promise<void> {
  const sessionKey = await getSessionKey();
  if (!sessionKey) return;
  await saveFormState(
    {
      sessionKey,
      form: onceForm(token),
      errors: [],
      values: { path: sent.path },
      notice: sent.notice,
      taken: true,
      expiresAt: expiryFrom(now),
    },
    now,
  );
}
