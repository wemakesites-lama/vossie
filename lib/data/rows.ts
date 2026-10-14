import type {
  ConversationStatus,
  NotificationKind,
  ReportReason,
  ReportTarget,
  SellerStatus,
  StaffRole,
} from "@/lib/types";

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
  /**
   * When the last post saved this attempt, or null before any has. `errors` and `resent` belong to that post, so the
   * page shows them only for a minute after it (SIGN_IN_ERRORS_SHOW_MS): the attempt lasts 30 minutes, and an old
   * error summary must not come back, and take focus, on a fresh visit.
   */
  postedAt: string | null;
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

// --- Messaging (messaging plan, Task 1; "Store design") ------------------------------------------------------------

/** A conversation between a buyer and a shop (messaging spec 2.2 and 4; plan decisions 1 and 2). */
export type ConversationRow = {
  id: string;
  /** The listing it's about, or null for a question about the shop. */
  listingId: string | null;
  /** The listing's title when it started, kept for when the listing has gone (selling spec 9). Null for a question. */
  listingTitle: string | null;
  /** The shop. Whoever owns it (sellerProfiles) answers for it. */
  sellerSlug: string;
  /** The buyer's account, or null once they've deleted it (plan decision 14). */
  buyerId: string | null;
  /** True once the shop's owner has deleted their account: no one answers for the shop here any more. */
  sellerGone: boolean;
  status: ConversationStatus;
  createdAt: string;
  lastMessageAt: string;
  /** The seller's first reply, for the 48-hour response rate (trust page, stage G). */
  firstReplyAt: string | null;
  /** When the seller marked it completed. Cleared when the buyer says it didn't happen. */
  completedAt: string | null;
  confirmedAt: string | null;
  confirmedBy: "buyer" | "auto" | null;
};

/** One message (messaging spec 4). */
export type MessageRow = {
  id: string;
  conversationId: string;
  /** Which side sent it. */
  from: "buyer" | "seller";
  /** Plain text, line breaks kept (spec 2.12). */
  body: string;
  /** A swap offer, sent with a buyer's first message (spec 2.4). */
  swapOffer: string | null;
  sentAt: string;
  /** When the other side opened the thread after it arrived. */
  readAt: string | null;
};

/** A report, for stage G's queue (messaging spec 3.4). */
export type ReportRow = {
  id: string;
  reporterId: string;
  targetKind: ReportTarget["kind"];
  /** A listing's id, a seller's slug or a request's id. */
  targetId: string;
  /** What the target was called when it was reported, in case it has gone by the time the Hub looks. */
  targetTitle: string;
  reason: ReportReason;
  /** Up to 500 characters; "" when none was given. */
  detail: string;
  /** Stage G closes it and records what was done. */
  status: "open" | "closed";
  createdAt: string;
};

/** A notification (messaging spec 2.9 and 3.5; plan decisions 12 and 13). */
export type NotificationRow = {
  id: string;
  accountId: string;
  kind: NotificationKind;
  /** What it's about: a conversation's id for messages and sales, a report's id, a shop's slug. */
  subjectId: string;
  /** The sentence, fixed when it was made. */
  text: string;
  /** Where it leads. */
  href: string;
  createdAt: string;
  readAt: string | null;
};
