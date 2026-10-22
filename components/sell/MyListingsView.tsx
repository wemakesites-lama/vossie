import Link from "next/link";
import { PlusIcon } from "@/components/icons";
import { EmptyState } from "@/components/kit/EmptyState";
import { ListRow } from "@/components/kit/ListRow";
import { PendingButton } from "@/components/kit/PendingButton";
import { Pill } from "@/components/kit/Pill";
import { LinkTabs } from "@/components/ui/LinkTabs";
import type { ListingRow } from "@/lib/data/rows";
import { priceLabel } from "@/lib/format";
import { changeListingState } from "@/lib/selling/listing-actions";
import { deleteListingPath, editListingPath, LISTINGS_TABS, myListingsPath, NEW_LISTING_PATH } from "@/lib/selling/paths";
import { shortSastDate } from "@/lib/time";
import type { ListingsTab } from "@/lib/types";
import { Thumb } from "./Thumb";

type MyListingsViewProps = {
  tab: ListingsTab;
  /** All the shop's listings; the view picks the tab's. */
  rows: readonly ListingRow[];
  /** The shop is waiting for approval, so everything is a draft (plan decision 4). */
  waiting: boolean;
  /** The shop is paused, so buyers see none of its listings (amendment 11.6). */
  paused: boolean;
  /** The Hub's reason when the Hub paused the shop (staff tools plan decision 3); the seller can't resume it. */
  hubPause?: string | null;
  notice: string | null;
  /** The listing the notice is about, for its link. */
  noticeListing: string | null;
};

const EMPTY: Readonly<Record<ListingsTab, { title: string; line: string }>> = {
  available: { title: "Nothing available right now", line: "Add a listing and students on your campus can find it." },
  paused: { title: "Nothing paused", line: "Pause a listing to hide it from buyers for a while, then resume it here." },
  sold: { title: "Nothing sold yet", line: "When something sells, mark it sold and it moves here." },
  drafts: { title: "No drafts", line: "Save a listing as a draft to finish it later. Only you can see drafts." },
};

/**
 * Your listings (selling spec 2.9, role views spec 7.1): the last action's notice, the four states as segments with
 * their counts, and the open state's listings as rows. Each row opens the listing's form ("Edit {title}"); its Pause,
 * Resume, Relist and Mark sold sit under it, and Delete is a text link set apart at the far end, never beside Mark
 * sold. An empty state offers New listing. While the shop is paused, buyers can't see the listing, so the notice offers
 * no look as a buyer; a shop the Hub paused says so, with the Hub's reason (staff tools plan decision 3).
 */
export function MyListingsView({ tab, rows, waiting, paused, hubPause = null, notice, noticeListing }: MyListingsViewProps) {
  const open = LISTINGS_TABS.find((item) => item.tab === tab)!;
  const shown = rows.filter((row) => row.state === open.state);
  const linkable = !paused && rows.some((row) => row.id === noticeListing && row.state !== "draft");
  return (
    <>
      {notice && (
        <p role="status" className="form-notice">
          {notice}
          {linkable && (
            <>
              {" "}
              <Link href={`/listings/${noticeListing}`} prefetch={false}>
                See it as buyers do
              </Link>
            </>
          )}
        </p>
      )}
      {waiting && (
        <p className="form-notice">
          Your shop is waiting for the Hub, so your listings stay drafts until it&apos;s approved.
        </p>
      )}
      {paused && hubPause !== null && (
        <p className="form-notice staff-hub-pause">
          {`Paused by the Hub: buyers can't see your listings.${hubPause ? ` The Hub said: ${hubPause}` : ""}`}
        </p>
      )}
      {paused && hubPause === null && (
        <p className="form-notice">Your shop is paused, so buyers can&apos;t see your listings until you resume it.</p>
      )}

      <LinkTabs
        label="Listings by state"
        look="segmented"
        current={tab}
        tabs={LISTINGS_TABS.map((item) => ({
          key: item.tab,
          label: item.label,
          count: rows.filter((row) => row.state === item.state).length,
          href: myListingsPath(item.tab),
        }))}
      />

      <section aria-labelledby="sell-list-title" className="sell-section">
        <h2 id="sell-list-title" className="sr-only">
          {open.label}
        </h2>
        {shown.length === 0 ? (
          <EmptyState
            icon={<PlusIcon />}
            title={EMPTY[tab].title}
            line={EMPTY[tab].line}
            action={{ label: "New listing", href: NEW_LISTING_PATH }}
          />
        ) : (
          <>
            <Link href={NEW_LISTING_PATH} prefetch={false} className="btn btn-primary mylist-new">
              New listing
            </Link>
            <ul className="kit-card mylist">
              {shown.map((row) => (
                <ListingItem key={row.id} row={row} tab={tab} />
              ))}
            </ul>
          </>
        )}
      </section>
    </>
  );
}

/**
 * A listing's photo, title, price and last update. Delete listing's page shows it too. A listing the Hub hid says so,
 * with the reason (staff tools plan decision 4).
 */
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
        {row.hiddenAt && (
          <p className="staff-hidden-note">{`Hidden by the Hub: ${row.hiddenReason ?? "no reason given"}`}</p>
        )}
      </div>
    </>
  );
}

function ListingItem({ row, tab }: { row: ListingRow; tab: ListingsTab }) {
  const cover = row.photos[0]?.src ?? `/placeholders/listing/${row.categorySlug}.svg`;
  const detail = `${priceLabel(row)} · Updated ${shortSastDate(row.updatedAt)}${row.hiddenAt ? " · Hidden by the Hub" : ""}`;
  return (
    <ListRow
      href={editListingPath(row.id)}
      label={`Edit ${row.title}`}
      lead={{ kind: "thumb", node: <Thumb src={cover} alt="" size={40} /> }}
      title={row.title}
      detail={detail}
      pill={row.hiddenAt ? <Pill tone="danger">Hidden</Pill> : undefined}
      actions={
        <>
          {row.hiddenAt && (
            <p className="staff-hidden-note">{`Hidden by the Hub: ${row.hiddenReason ?? "no reason given"}`}</p>
          )}
          <div className="mylist-actions">
            {row.state === "available" && <StateButton row={row} tab={tab} to="paused" label="Pause" />}
            {row.state === "paused" && <StateButton row={row} tab={tab} to="available" label="Resume" />}
            {row.state === "sold" && <StateButton row={row} tab={tab} to="available" label="Relist" />}
            {(row.state === "available" || row.state === "paused") && (
              <StateButton row={row} tab={tab} to="sold" label="Mark sold" />
            )}
          </div>
          <Link href={deleteListingPath(row.id)} prefetch={false} className="mylist-delete">
            Delete <span className="sr-only">{row.title}</span>
          </Link>
        </>
      }
    />
  );
}

/**
 * One of the row's buttons (plan decision 3): a small form posting the listing, the move and the open tab. It says
 * "Saving…" and takes no second press while it posts (role views N2 plan decision 17).
 */
function StateButton({ row, tab, to, label }: { row: ListingRow; tab: ListingsTab; to: string; label: string }) {
  return (
    <form action={changeListingState}>
      <input type="hidden" name="listing" value={row.id} />
      <input type="hidden" name="to" value={to} />
      <input type="hidden" name="tab" value={tab} />
      <PendingButton className="sell-action" pendingLabel="Saving…">
        {label} <span className="sr-only">{row.title}</span>
      </PendingButton>
    </form>
  );
}
