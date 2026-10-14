// The tips beside the composer and the server's scam check (messaging spec 2.3, plan decision 9). They follow the
// safety page's "Signs of a scam". The words are samples for Lama to change (plan decision 26).

export type ScamWarning = "advance" | "deposit" | "bank" | "courier" | "code";

/** The three tips always shown beside the composer (spec 2.3). */
export const SAFETY_TIPS: readonly string[] = [
  "Meet on campus, at a pickup point, in daylight.",
  "See it before you pay. Never pay a deposit.",
  "Never share bank details or a code sent to your phone.",
];

/** The tip for each warning, in the order they're shown. */
export const SCAM_TIPS: ReadonlyMap<ScamWarning, string> = new Map([
  ["advance", "Never pay before you've seen the item or had the service. Pay when you meet."],
  ["deposit", "Don't pay a deposit or a booking fee to hold something. A real seller can wait until you meet."],
  ["bank", "Don't share bank details, card numbers or PINs in messages. Vossie will never ask for them."],
  ["courier", "Vossie is for meeting on campus. A courier means paying before you've seen it."],
  ["code", "Never share a code sent to your phone. Anyone who asks for one is trying to get into your accounts."],
]);

// What each warning looks for, in lower case. Words match whole (\b), so "decode" isn't "code" and "pinout" isn't
// "pin". A false alarm costs one tap on Send anyway; a missed scam costs more.
const PATTERNS: ReadonlyArray<readonly [ScamWarning, RegExp]> = [
  [
    "advance",
    /\b(pay|paying|payment|send (the )?money|e-?wallet|eft)\b[^.!?\n]{0,40}\b(first|upfront|up front|in advance)\b|\b(upfront|up-front|prepay|pre-pay)\b/,
  ],
  ["deposit", /\b(deposits?|booking fees?|holding fees?)\b/],
  ["bank", /\b(bank(ing)? details|account number|acc(ount)? (no|num)|branch code|card number|cvv|pin)\b/],
  ["courier", /\b(courier|paxi|pudo|postnet|delivery fee|shipping)\b/],
  ["code", /\b(otp|one[- ]time (pin|password|code)|verification code|(send|share|give|forward) (me )?(the|your|that) code)\b/],
];

/** The warnings a message needs, in SCAM_TIPS's order (spec 2.3). Most messages need none. */
export function scamWarnings(text: string): ScamWarning[] {
  const lower = text.toLowerCase();
  const found = new Set(PATTERNS.filter(([, pattern]) => pattern.test(lower)).map(([kind]) => kind));
  return [...SCAM_TIPS.keys()].filter((kind) => found.has(kind));
}

/** Warnings kept in form state as "advance,code", read back. Anything else is dropped. */
export function parseWarnings(value: string | undefined): ScamWarning[] {
  const kinds = new Set((value ?? "").split(","));
  return [...SCAM_TIPS.keys()].filter((kind) => kinds.has(kind));
}
