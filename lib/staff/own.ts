import { ownsListing, ownsRequest, ownsShop } from "@/lib/data/staff-shops";
import type { ReportTarget } from "@/lib/types";

// Whose a report's target is (stage L spec decisions 1 and 2). A plain module, not a "use server" file: there, every
// export is an endpoint anyone can post to. Async, over lib/data's ownsShop, ownsListing and ownsRequest, so it answers
// on either backend (C4/C5 plan decision 5).

/** What of the admin's own a report is about: their shop, a listing of it, or their Looking For request. */
export type OwnKind = "shop" | "listing" | "request";

/** The kind of the admin's own thing this target is, or null when it's someone else's (or nobody's). */
export async function ownsTarget(accountId: string, target: ReportTarget): Promise<OwnKind | null> {
  switch (target.kind) {
    case "seller":
      return (await ownsShop(accountId, target.id)) ? "shop" : null;
    case "listing":
      return (await ownsListing(accountId, target.id)) ? "listing" : null;
    case "request":
      return (await ownsRequest(accountId, target.id)) ? "request" : null;
  }
}
