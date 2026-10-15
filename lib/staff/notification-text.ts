// The sentences staff actions send (staff tools spec 2.3 and 2.4; plan decisions 7 and 22), fixed when each
// notification is made. Reasons stay out of them: each links to where its reason shows (/sell, My listings). The
// words are samples for Lama to change.

/** Approval, with E's "shop-approved" kind. */
export function shopApprovedText(shop: string): string {
  return `The Hub approved ${shop}. You can publish your listings now.`;
}

/** The Hub's other decisions about a shop, with the "shop-update" kind. */
export function shopDecisionText(
  decision: "declined" | "paused" | "resumed" | "verified" | "unverified",
  shop: string,
): string {
  switch (decision) {
    case "declined":
      return `The Hub didn't approve ${shop} yet. See why, and send it again.`;
    case "paused":
      return `The Hub paused ${shop}. See why on your dashboard.`;
    case "resumed":
      return `The Hub resumed ${shop}. Buyers can see it again.`;
    case "verified":
      return `${shop} is now Verified by the Hub.`;
    case "unverified":
      return `${shop} is no longer Verified by the Hub.`;
  }
}

/** A hidden listing, with the "shop-update" kind. */
export function listingHiddenText(title: string): string {
  return `The Hub hid ${title}. See why in My listings.`;
}

/** A report's outcome for its reporter, with E's "report-handled" kind, in the spec's words (spec 2.3). */
export function reportOutcomeText(outcome: "acted" | "dismissed", title: string): string {
  return outcome === "acted"
    ? `Thanks, we've acted on your report about ${title}.`
    : `We looked at your report about ${title} and didn't find a problem.`;
}

/** A slot request's answer for the student, with the "booking" kind (spec 2.4). */
export function slotAnswerText(answer: "accepted" | "declined", postTitle: string): string {
  return answer === "accepted"
    ? `A mentor accepted your slot request for ${postTitle}.`
    : `A mentor couldn't fit in your slot request for ${postTitle}. You can ask again.`;
}

/** A new slot request, for the office hours' author (plan decision 13), with the "booking" kind. */
export function slotRequestedText(student: string, postTitle: string): string {
  return `${student} asked for a slot at ${postTitle}.`;
}
