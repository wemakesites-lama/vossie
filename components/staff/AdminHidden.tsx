import Link from "next/link";
import type { HiddenItem } from "@/lib/data/staff-reports";
import { showListingPath, showRequestPath } from "@/lib/staff/paths";
import { shortSastDate } from "@/lib/time";
import { StaffTable } from "./StaffTable";

type AdminHiddenProps = {
  /** Newest hidden first. */
  listings: readonly HiddenItem[];
  requests: readonly HiddenItem[];
  campusNames: ReadonlyMap<string, string>;
};

function ShowLink({ item }: { item: HiddenItem }) {
  const href = item.kind === "listing" ? showListingPath(item.id) : showRequestPath(item.id);
  return (
    <Link href={href} prefetch={false} className="staff-row-action">
      Show again
      <span className="sr-only">{`: ${item.title}`}</span>
    </Link>
  );
}

function HiddenOn({ item }: { item: HiddenItem }) {
  return <time dateTime={item.hiddenAt}>{shortSastDate(item.hiddenAt)}</time>;
}

/**
 * What the Hub has hidden (spec decision 14): listings and Looking For requests, newest hidden first, each with Show
 * again. A request never names its asker. The words are samples for Lama to change.
 */
export function AdminHidden({ listings, requests, campusNames }: AdminHiddenProps) {
  const campus = (slug: string) => campusNames.get(slug) ?? slug;
  return (
    <>
      <p>
        Everything the Hub has hidden after a report, newest first. Showing one again can&apos;t be undone here: to hide
        it again, someone has to report it.
      </p>
      <section aria-labelledby="admin-hidden-listings-title" className="staff-section">
        <h2 id="admin-hidden-listings-title" className="staff-section-title">
          Listings
        </h2>
        <StaffTable
          caption={`Hidden listings (${listings.length})`}
          columns={["Listing", "Shop", "Campus", "Hidden on", "Reason", "Show again"]}
          rows={listings.map((item) => ({
            key: item.id,
            cells: [
              item.title,
              item.shopName ?? "",
              campus(item.campusSlug),
              <HiddenOn key="on" item={item} />,
              item.reason,
              <ShowLink key="show" item={item} />,
            ],
          }))}
          empty="No hidden listings."
        />
      </section>
      <section aria-labelledby="admin-hidden-requests-title" className="staff-section">
        <h2 id="admin-hidden-requests-title" className="staff-section-title">
          Looking For requests
        </h2>
        <StaffTable
          caption={`Hidden requests (${requests.length})`}
          columns={["Request", "Campus", "Hidden on", "Reason", "Show again"]}
          rows={requests.map((item) => ({
            key: item.id,
            cells: [
              item.title,
              campus(item.campusSlug),
              <HiddenOn key="on" item={item} />,
              item.reason,
              <ShowLink key="show" item={item} />,
            ],
          }))}
          empty="No hidden requests."
        />
      </section>
    </>
  );
}
