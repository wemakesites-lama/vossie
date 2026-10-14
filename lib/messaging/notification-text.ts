// The notifications' sentences (messaging spec 3.5, plan decisions 13 and 26), fixed when a notification is made.
// Plain functions; the sample notifications in data/fixtures/messages.ts use the same words (their test checks).

/** "Ayanda asked about {title}" for a first message, "Tech corner replied about {title}" after that. */
export function messageNoteText({
  sender,
  listingTitle,
  first,
}: {
  sender: string;
  listingTitle: string | null;
  first: boolean;
}): string {
  if (listingTitle) return `${sender} ${first ? "asked" : "replied"} about ${listingTitle}`;
  return first ? `${sender} asked your shop a question` : `${sender} replied`;
}

/** The buyer's prompt when the seller marks the sale done (spec 2.9's "a sale to confirm"). */
export function saleNoteText({ shop, listingTitle }: { shop: string; listingTitle: string | null }): string {
  return `${shop} marked ${listingTitle ?? "your enquiry"} as done. Did the sale happen?`;
}
