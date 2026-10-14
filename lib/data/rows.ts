import type { SellerStatus, StaffRole } from "@/lib/types";

// The sample store's rows (accounts spec section 4), shaped like the Supabase tables that will replace them: ids are
// text, times are ISO 8601 strings in UTC, and rows point at each other by id. Only lib/data reads or writes them.
// Later stages add their rows here (the accounts plan's "Store design").

export type AccountRow = {
  id: string;
  /** Lower case. */
  email: string;
  firstName: string;
  campusSlug: string;
  roles: StaffRole[];
  createdAt: string;
};

/** One per account that has applied to sell, keyed by the account's id. Stage F adds the shop's details. */
export type SellerProfileRow = {
  accountId: string;
  status: SellerStatus;
  sellerSlug: string | null;
  appliedAt: string;
};

export type ConsentRow = {
  id: string;
  accountId: string;
  version: string;
  agreedAt: string;
};

/** A signed-in browser. The key is the SHA-256 of the cookie's random token, so the store never holds the token. */
export type SessionRow = {
  key: string;
  accountId: string;
  createdAt: string;
  expiresAt: string;
};

export type SignInStep = "email" | "code" | "profile";

/** What went wrong on the last post (accounts spec 3.1), in the order the error summary lists them. */
export type SignInError =
  | "email-missing"
  | "email-domain"
  | "email-rate"
  | "consent-missing"
  | "code-missing"
  | "code-wrong"
  | "code-expired"
  | "code-rate"
  | "locked"
  | "first-name-missing"
  | "first-name-length"
  | "campus-missing";

/** A sign-in in progress, keyed by the SHA-256 of the `vossie_signin` cookie's token (accounts spec 2.2). */
export type SignInAttemptRow = {
  key: string;
  step: SignInStep;
  /** Lower case. On step 1 after an error, what was typed, so the field can show it again. */
  email: string;
  errors: SignInError[];
  /** True straight after "Send a new code", so step 2 can say so. */
  resent: boolean;
  /** The SHA-256 of the attempt's key and the code (lib/auth/secrets.ts). Never the code itself (spec 5). */
  codeHash: string | null;
  codeExpiresAt: string | null;
  /** Wrong tries on the current code. */
  wrongTries: number;
  /** When the privacy policy box was ticked, or null when it wasn't. */
  consentedAt: string | null;
  /** Step 3's answers after an error, so the fields can show them again. */
  firstName: string;
  campusSlug: string;
  expiresAt: string;
};

/**
 * Sample mode's stand-in for the email service (accounts spec 2.3): the last code "sent" for each attempt, keyed by
 * the attempt's key, so the sign-in page can show it. The real email service replaces this table; nothing else reads it.
 */
export type SampleEmailRow = {
  attemptKey: string;
  to: string;
  code: string;
  sentAt: string;
};

/**
 * A signed-in form's state after a post (accounts plan decision 3): its errors and typed values, or a notice such as
 * "saved". Keyed by `${sessionKey}:${form}`, so it belongs to one browser's session and one form.
 */
export type FormStateRow = {
  key: string;
  sessionKey: string;
  form: string;
  errors: string[];
  values: Record<string, string>;
  notice: string | null;
  expiresAt: string;
};
