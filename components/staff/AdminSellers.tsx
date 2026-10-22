import Link from "next/link";
import type { ShopReview } from "@/lib/data/staff-shops";
import { adminSellerPath } from "@/lib/staff/paths";
import { shortSastDate } from "@/lib/time";
import { StaffTable } from "./StaffTable";

/** Where a shop stands, in a word or three (spec 2.3, plan decisions 2 and 3). */
export function standingWords(review: Pick<ShopReview, "standing" | "declinedAt" | "pausedBy">): string {
  switch (review.standing) {
    case "waiting":
      return "Waiting";
    case "declined":
      return `Declined on ${shortSastDate(review.declinedAt ?? "")}`;
    case "open":
      return "Open";
    case "paused":
      return review.pausedBy === "staff" ? "Paused by the Hub" : "Paused by the seller";
  }
}

function ReviewLink({ review }: { review: ShopReview }) {
  return (
    <Link href={adminSellerPath(review.shop.slug)} prefetch={false} className="staff-row-action">
      Review <span className="sr-only">{review.shop.name}</span>
    </Link>
  );
}

/**
 * Sellers (spec 2.3): the shops waiting for approval first (declined ones with them, until they're sent again), then
 * every open and paused shop, each with a link to its review page, which names the shop.
 */
export function AdminSellers({
  rows,
  campusNames,
  campusName = null,
}: {
  rows: readonly ShopReview[];
  campusNames: ReadonlyMap<string, string>;
  /** The campus the list is filtered to, for the captions (role views spec 7.2). */
  campusName?: string | null;
}) {
  const at = campusName ? ` · ${campusName}` : "";
  const waiting = rows.filter((row) => row.standing === "waiting" || row.standing === "declined");
  const others = rows.filter((row) => row.standing === "open" || row.standing === "paused");
  const campus = (row: ShopReview) => campusNames.get(row.shop.campusSlug) ?? row.shop.campusSlug;
  return (
    <>
      <section aria-labelledby="admin-waiting-title" className="staff-section">
        <h2 id="admin-waiting-title" className="staff-section-title">
          Waiting for approval
        </h2>
        <StaffTable
          caption={`Shops waiting for approval, oldest first${at}`}
          columns={["Shop", "Campus", "Applied", "Status", "Review"]}
          rows={waiting.map((row) => ({
            key: row.shop.slug,
            cells: [
              row.shop.name,
              campus(row),
              row.appliedAt ? (
                <time key="applied" dateTime={row.appliedAt}>
                  {shortSastDate(row.appliedAt)}
                </time>
              ) : (
                ""
              ),
              standingWords(row),
              <ReviewLink key="review" review={row} />,
            ],
          }))}
          empty="Nobody is waiting for approval."
        />
      </section>
      <section aria-labelledby="admin-shops-title" className="staff-section">
        <h2 id="admin-shops-title" className="staff-section-title">
          Every shop
        </h2>
        <StaffTable
          caption={`Open and paused shops, A to Z${at}`}
          columns={["Shop", "Campus", "Owner", "Status", "Verified", "Listed", "Review"]}
          rows={others.map((row) => ({
            key: row.shop.slug,
            cells: [
              row.shop.name,
              campus(row),
              row.owner?.firstName ?? "Sample shop",
              standingWords(row),
              row.shop.verified ? "Yes" : "No",
              String(row.listedCount),
              <ReviewLink key="review" review={row} />,
            ],
          }))}
          empty="No shops yet."
        />
      </section>
    </>
  );
}
