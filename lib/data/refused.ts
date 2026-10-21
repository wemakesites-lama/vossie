// A Supabase function's refusal that the sample function's return type has no room for (C2/C3 plan decision 3 and
// amendment 3; C4/C5 plan decision 2). The sample never throws it; the Supabase twins do, when the database refuses
// something the action's own checks normally catch first (two posts at once past a message limit, a report past the
// 10th) or a result the sample's shape can't carry (a one-time token taken, an own shop). Exported signatures stay as
// they are.
//
// Actions catch it only where their task says, around the one data call that can meet it (refusalOf, or isRefused in a
// catch), and show their usual form error; redirect() stays outside the try, and anything else is rethrown, Next's
// redirects included. A call that should never reach Supabase (a TypeScript writer the database does in SQL, an account
// deletion path) throws a plain Error instead, so no form error can hide it (amendment 4).
//
// A plain module that imports nothing, so client, sample and Supabase code can all read it.

/** Every refusal a twin may throw: C2/C3's (selling, photos, messaging, reports, offers) and C4/C5's (community, staff). */
export type RefusalCode =
  // C2/C3: the shop's race refusals (update_shop), Hub-only photo calls, reports, the message limits, start_conversation
  // and start_offer.
  | "forbidden"
  | "name-taken"
  | "slug-taken"
  | "points-invalid"
  | "photo-invalid"
  | "rate-limited"
  | "not-found"
  | "conversation-rate"
  | "message-rate"
  | "offer-rate"
  | "own-shop"
  | "own"
  | "no-shop"
  | "pending"
  | "paused"
  | "closed"
  | "sample"
  | "listing-invalid"
  // C4/C5: staff gates, one-time tokens, the requests' limits and dates, Hub covers and check-ins.
  | "own-request"
  | "once-expired"
  | "once-taken"
  | "open-limit"
  | "daily-limit"
  | "reopen-limit"
  | "day-past"
  | "day-far"
  | "date-past"
  | "cover-invalid"
  | "check-in-day-future";

export class Refused extends Error {
  readonly code: RefusalCode;

  constructor(code: RefusalCode) {
    super(`Refused: ${code}`);
    this.name = "Refused";
    this.code = code;
  }
}

/** Whether `error` is a refusal, and one of `codes` when any are named. */
export function isRefused(error: unknown, ...codes: RefusalCode[]): error is Refused {
  return error instanceof Refused && (codes.length === 0 || codes.includes(error.code));
}

/** What `work` gives, or the refusal it was met with. Anything else it throws is rethrown, Next's redirects included. */
export async function refusalOf<T>(work: Promise<T>): Promise<{ ok: T } | { refused: RefusalCode }> {
  try {
    return { ok: await work };
  } catch (error) {
    if (error instanceof Refused) return { refused: error.code };
    throw error;
  }
}
