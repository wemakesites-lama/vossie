import { vi } from "vitest";
import type { SendOutcome, SessionClaims, VerifyOutcome } from "@/lib/data/auth-session";
import type { SignInAttemptRow } from "@/lib/data/rows";
import type { Account } from "@/lib/types";

/**
 * Stand-ins for Supabase in lib/auth's unit tests (Supabase phase B, Task 5): the auth session façade
 * (lib/data/auth-session) and the Supabase twins of sign-in, accounts and form states, all over one plain state object
 * made with vi.hoisted, so a test sets what Supabase answers and reads what was asked, in order:
 *
 *   const supabase = vi.hoisted(() => ({}) as SupabaseFakes);
 *   vi.mock("@/lib/data/auth-session", async () => (await import("@/tests/helpers/supabase-auth-fakes")).authSessionModule(supabase));
 *   vi.mock("@/lib/data/supabase/sign-in", async () => (await import("@/tests/helpers/supabase-auth-fakes")).signInTwin(supabase));
 *   vi.mock("@/lib/data/supabase/accounts", async () => (await import("@/tests/helpers/supabase-auth-fakes")).accountsTwin(supabase));
 *   vi.mock("@/lib/data/supabase/form-states", async () => (await import("@/tests/helpers/supabase-auth-fakes")).formStatesTwin(supabase));
 *   beforeEach(() => resetSupabaseFakes(supabase));
 *
 * The sample paths never reach them, so a file can hold sample and Supabase tests.
 */
export type SupabaseFakes = {
  /** What currentClaims() and readClaims() answer: the verified session, or null. */
  claims: SessionClaims | null;
  /** What liveUserId() answers. */
  liveUserId: string | null;
  sendOutcome: SendOutcome;
  verifyOutcome: VerifyOutcome;
  /** Whether signOutHere() rejects (Supabase unreachable). */
  signOutRejects: boolean;
  /** Whether reserveCodeSend() finds room. */
  reserveAnswer: boolean;
  /** The sends reserveIpSend() has counted, by network key (the IP's keyed hash). */
  ipSends: Map<string, number>;
  /** Set to make the attempt vanish (swept, or ended in another tab) just before a try is counted. */
  attemptGoneBeforeCount: boolean;
  /** Every call, in order: "send:<email>", "verify:<code>", "recordWrongTry", "reserveIp", "reserve", "signOutHere", … */
  calls: string[];
  /** The attempts the sign-in twin keeps, by key. */
  attempts: Map<string, SignInAttemptRow>;
  /** The accounts with a profile, by Auth user id. */
  profiles: Map<string, Account>;
  consents: { accountId: string; version: string }[];
};

export function resetSupabaseFakes(fakes: SupabaseFakes): void {
  Object.assign(fakes, {
    claims: null,
    liveUserId: null,
    sendOutcome: "sent",
    verifyOutcome: "wrong",
    signOutRejects: false,
    reserveAnswer: true,
    ipSends: new Map(),
    attemptGoneBeforeCount: false,
    calls: [],
    attempts: new Map(),
    profiles: new Map(),
    consents: [],
  } satisfies SupabaseFakes);
}

/** A profile for an Auth user, as getViewerAccount gives it. */
export function supabaseAccount(id: string, email: string, overrides: Partial<Account> = {}): Account {
  return { id, email, firstName: "Thandi", campusSlug: "pretoria", roles: [], seller: null, createdAt: "2026-10-01T08:00:00.000Z", ...overrides };
}

export function authSessionModule(fakes: SupabaseFakes) {
  return {
    currentClaims: vi.fn(async () => {
      fakes.calls.push("currentClaims");
      return fakes.claims;
    }),
    readClaims: vi.fn(async () => {
      fakes.calls.push("readClaims");
      return fakes.claims;
    }),
    liveUserId: vi.fn(async () => {
      fakes.calls.push("liveUserId");
      return fakes.liveUserId;
    }),
    sendSignInCode: vi.fn(async (email: string) => {
      fakes.calls.push(`send:${email}`);
      return fakes.sendOutcome;
    }),
    verifySignInCode: vi.fn(async (email: string, code: string) => {
      fakes.calls.push(`verify:${code}`);
      const outcome = fakes.verifyOutcome;
      // A right code sets the new session's cookie, which the rest of the request reads back.
      if (typeof outcome === "object") fakes.claims = { userId: outcome.userId, sessionId: "session-new", email };
      return outcome;
    }),
    signInDemo: vi.fn(async (email: string) => {
      fakes.calls.push(`demo:${email}`);
      const outcome = fakes.verifyOutcome;
      if (typeof outcome === "object") fakes.claims = { userId: outcome.userId, sessionId: "session-new", email };
      return outcome;
    }),
    signOutHere: vi.fn(async () => {
      fakes.calls.push("signOutHere");
      if (fakes.signOutRejects) throw new Error("Supabase is unreachable");
      fakes.claims = null;
    }),
    clearAuthCookies: vi.fn(async () => {
      fakes.calls.push("clearAuthCookies");
      fakes.claims = null;
    }),
  };
}

export function signInTwin(fakes: SupabaseFakes) {
  return {
    getSignInAttempt: async (key: string) => {
      const row = fakes.attempts.get(key);
      return row && Date.parse(row.expiresAt) > Date.now() ? structuredClone(row) : null;
    },
    saveSignInAttempt: async (attempt: SignInAttemptRow) => {
      fakes.calls.push("save");
      fakes.attempts.set(attempt.key, structuredClone({ ...attempt, codeHash: null }));
    },
    deleteSignInAttempt: async (key: string) => {
      fakes.calls.push("deleteAttempt");
      fakes.attempts.delete(key);
    },
    recordWrongTry: async (key: string) => {
      fakes.calls.push("recordWrongTry");
      if (fakes.attemptGoneBeforeCount) fakes.attempts.delete(key);
      const row = fakes.attempts.get(key);
      if (!row) return 0;
      row.wrongTries += 1;
      return row.wrongTries;
    },
    reserveCodeSend: async () => {
      fakes.calls.push("reserve");
      return fakes.reserveAnswer;
    },
    reserveIpSend: async (ipKey: string, _now: Date, limit: number) => {
      fakes.calls.push("reserveIp");
      const sent = fakes.ipSends.get(ipKey) ?? 0;
      if (sent >= limit) return false;
      fakes.ipSends.set(ipKey, sent + 1);
      return true;
    },
    countCodesSent: async () => 0,
    recordCodeSent: async () => {},
    saveSampleEmail: async () => {
      throw new Error("Supabase has no sample outbox");
    },
    getSampleEmail: async () => null,
  };
}

export function accountsTwin(fakes: SupabaseFakes) {
  return {
    getViewerAccount: async (claims: SessionClaims) => {
      const account = fakes.profiles.get(claims.userId);
      return account ? structuredClone(account) : null;
    },
    getAccount: async (id: string) => {
      const account = fakes.profiles.get(id);
      return account ? structuredClone(account) : null;
    },
    hasProfile: async (id: string) => {
      fakes.calls.push("hasProfile");
      return fakes.profiles.has(id);
    },
    recordConsent: async (accountId: string, version: string) => {
      fakes.calls.push("recordConsent");
      fakes.consents.push({ accountId, version });
    },
    completeProfile: async (details: { firstName: string; campusSlug: string; policyVersion: string }) => {
      fakes.calls.push("completeProfile");
      const claims = fakes.claims;
      if (!claims || fakes.profiles.has(claims.userId)) return false;
      fakes.profiles.set(claims.userId, supabaseAccount(claims.userId, claims.email, { firstName: details.firstName, campusSlug: details.campusSlug }));
      fakes.consents.push({ accountId: claims.userId, version: details.policyVersion });
      return true;
    },
    createAccount: async () => {
      throw new Error("createAccount() isn't on Supabase");
    },
    findAccountByEmail: async () => {
      throw new Error("findAccountByEmail() isn't on Supabase");
    },
    restoreSampleAccount: async () => null,
  };
}

export function formStatesTwin(fakes: SupabaseFakes) {
  return {
    getFormState: async () => null,
    saveFormState: async () => {},
    clearFormState: async () => {},
    takeFormState: async () => {
      throw new Error("takeFormState runs in SQL on Supabase (phase C)");
    },
    clearSessionFormStates: async (sessionId: string) => {
      fakes.calls.push(`clearSessionFormStates:${sessionId}`);
    },
  };
}
