// Shop coach's catalogue (AI round two spec 2.1): the only kinds an action can be, in the spec's order, which is also
// the fixed week's order (planning decision 2). The model never adds a kind (I2 checks its ids). Pure.

export const COACH_KINDS = [
  "reply-waiting",
  "mark-sold",
  "add-photos",
  "say-more",
  "refresh-quiet",
  "check-price",
  "answer-request",
  "list-more",
  "finish-shop",
  "go-to-launchpad",
  "read-tip",
] as const;

export type CoachKind = (typeof COACH_KINDS)[number];

/** The kinds the app can't check (spec 2.1): the seller ticks them, this week only (planning decision 13). */
export const SELLER_TICKED: ReadonlySet<CoachKind> = new Set(["check-price", "read-tip"]);

/** At most this many actions a week (spec 2). */
export const ACTIONS_A_WEEK = 3;
/** At most this many candidates of one kind (planning decision 2). */
export const PER_KIND = 2;
export const TITLE_MAX = 70;
export const WHY_MAX = 140;

// The thresholds (spec 2.1; planning decision 5).
export const REPLY_WAIT_HOURS = 24;
export const PHOTOS_WANTED = 2;
export const DESCRIPTION_WANTED = 80;
export const QUIET_DAYS = 21;
export const PRICE_RATIO = 1.5;
export const SIMILAR_WANTED = 3;
export const LISTINGS_WANTED = 3;
export const LAUNCHPAD_DAYS = 14;
/** A tip ticked in this many weeks isn't offered again (planning decision 9); also how long rows are kept (spec 4). */
export const WEEKS_KEPT = 12;

/** Each kind as the Hub team reads it ("What shops need", stage I2). Samples for Lama to change. */
export const KIND_LABELS: Readonly<Record<CoachKind, string>> = {
  "reply-waiting": "Reply to waiting buyers",
  "mark-sold": "Mark sales as sold",
  "add-photos": "Add photos",
  "say-more": "Say more in a description",
  "refresh-quiet": "Refresh a quiet listing",
  "check-price": "Check a price",
  "answer-request": "Answer a Looking For request",
  "list-more": "List more",
  "finish-shop": "Finish the shop's page",
  "go-to-launchpad": "Go to a Launchpad event or office hours",
  "read-tip": "Read a Launchpad tip",
};
