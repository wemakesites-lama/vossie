import Link from "next/link";
import type { ListingRow } from "@/lib/data/rows";
import { priceLabel } from "@/lib/format";
import { changeListingState } from "@/lib/selling/listing-actions";
import { deleteListingPath, editListingPath, LISTINGS_TABS, myListingsPath } from "@/lib/selling/paths";
import { shortSastDate } from "@/lib/time";
import type { ListingState, ListingsTab } from "@/lib/types";
import { Thumb } from "./Thumb";

type MyListingsViewProps = {
  tab: ListingsTab;
  /** All the shop's listings; the view picks the tab's. */
  rows: readonly ListingRow[];
  /** The shop is waiting for approval, so everything is a draft (plan decision 4). */
  waiting: boolean;
  notice: string | null;
  /** The listing the notice is about, for its link. */
  noticeListing: string | null;
};

const EMPTY: Readonly<Record<ListingsTab, string>> = {
  available: "Nothing available right now.",
  paused: "Nothing paused.",
  sold: "Nothing sold yet.",
  drafts: "No drafts.",
};

/**
 * My listings (selling spec 2.9): the last action's notice, the four tabs as links with their counts, and the open
 * tab's listings, each with its photo, title, price, last update and actions. Each button and link names its listing.
 */
export function MyListingsView({ tab, rows, waiting, notice, noticeListing }: MyListingsViewProps) {
  const open = LISTINGS_TABS.find((item) => item.tab === tab)!;
  const shown = rows.filter((row) => row.state === open.state);
  // A draft has no page buyers can see, so its notice links nowhere.
  const linkable = rows.some((row) => row.id === noticeListing && row.state !== "draft");
  return (
    <>
      {notice && (
        <p role="status" className="form-notice">
          {notice}
          {linkable && (
            <>
              {" "}
              <Link href={`/listings/${noticeListing}`} prefetch={false} className="sell-notice-link">
                See it as buyers do
              </Link>
            </>
          )}
        </p>
      )}
      {waiting && (
        <p className="form-notice">
          Your shop is waiting for the Hub, so your listings are saved as drafts. Once it&apos;s approved, you publish
          them one by one.
        </p>
      )}

      <nav aria-label="Listings by state" className="sell-tabs">
        <ul>
          {LISTINGS_TABS.map((item) => (
            <li key={item.tab}>
              <Link
                href={myListingsPath(item.tab)}
                prefetch={false}
                aria-current={item.tab === tab ? "page" : undefined}
                className="sell-tab"
              >
                {item.label} <span className="sell-tab-count">({rows.filter((row) => row.state === item.state).length})</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <section aria-labelledby={`sell-list-${tab}-title`} className="sell-section">
        <h2 id={`sell-list-${tab}-title`} className="sr-only">
          {open.label}
        </h2>
        {shown.length === 0 ? (
          <p className="sell-empty">{EMPTY[tab]}</p>
        ) : (
          <ul className="sell-list">
            {shown.map((row) => (
              <ListingItem key={row.id} row={row} tab={tab} />
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

/** A listing's photo, title, price and last update. Delete listing's page shows it too. */
export function ListingSummary({ row }: { row: ListingRow }) {
  const cover = row.photos[0]?.src ?? `/placeholders/listing/${row.categorySlug}.svg`;
  return (
    <>
      <Thumb src={cover} alt="" size={64} />
      <div>
        <p className="sell-item-title">{row.title}</p>
        <p className="sell-item-meta">
          {priceLabel(row)} · Updated {shortSastDate(row.updatedAt)}
        </p>
      </div>
    </>
  );
}

function ListingItem({ row, tab }: { row: ListingRow; tab: ListingsTab }) {
  return (
    <li className="sell-item">
      <ListingSummary row={row} />
      <div className="sell-item-actions">
        <Link href={editListingPath(row.id)} prefetch={false} className="sell-action">
          Edit <span className="sr-only">{row.title}</span>
        </Link>
        {row.state === "available" && <StateButton row={row} tab={tab} to="paused" label="Pause" />}
        {row.state === "paused" && <StateButton row={row} tab={tab} to="available" label="Resume" />}
        {row.state === "sold" && <StateButton row={row} tab={tab} to="available" label="Relist" />}
        {(row.state === "available" || row.state === "paused") && (
          <StateButton row={row} tab={tab} to="sold" label="Mark sold" />
        )}
        <Link href={deleteListingPath(row.id)} prefetch={false} className="sell-action sell-action-danger">
          Delete <span className="sr-only">{row.title}</span>
        </Link>
      </div>
    </li>
  );
}

type StateButtonProps = { row: ListingRow; tab: ListingsTab; to: Exclude<ListingState, "draft">; label: string };

/**
 * One of the row's buttons (plan decision 3): a small form posting the listing's id, the move and the open tab. The
 * action looks the id up among the signed-in seller's own listings.
 */
function StateButton({ row, tab, to, label }: StateButtonProps) {
  return (
    <form action={changeListingState}>
      <input type="hidden" name="listing" value={row.id} />
      <input type="hidden" name="to" value={to} />
      <input type="hidden" name="tab" value={tab} />
      <button type="submit" className="sell-action">
        {label} <span className="sr-only">{row.title}</span>
      </button>
    </form>
  );
}
