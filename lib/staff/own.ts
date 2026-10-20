import { isOwnListing, isOwnRequest, isOwnShop } from "@/lib/data/staff-shops";
import type { ReportTarget } from "@/lib/types";

// Whose a report's target is (stage L spec decisions 1 and 2). A plain module, not a "use server" file: there, every
// export is an endpoint anyone can post to.

/** What of the admin's own a report is about: their shop, a listing of it, or their Looking For request. */
export type OwnKind = "shop" | "listing" | "request";

/** The kind of the admin's own thing this target is, or null when it's someone else's (or nobody's). */
export function ownsTarget(accountId: string, target: ReportTarget): OwnKind | null {
  switch (target.kind) {
    case "seller":
      return isOwnShop(accountId, target.id) ? "shop" : null;
    case "listing":
      return isOwnListing(accountId, target.id) ? "listing" : null;
    case "request":
      return isOwnRequest(accountId, target.id) ? "request" : null;
  }
}
