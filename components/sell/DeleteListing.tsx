import Link from "next/link";
import { notFound } from "next/navigation";
import { getOwnListing } from "@/lib/data/own-listings";
import { isId } from "@/lib/messaging/paths";
import { deleteListingForm } from "@/lib/selling/listing-actions";
import { requireShopOwner } from "@/lib/selling/owner";
import { deleteListingPath, myListingsPath, tabFor } from "@/lib/selling/paths";
import { ListingSummary } from "./MyListingsView";

/**
 * Delete listing's confirmation (selling spec 2.9): which listing, what deleting does, Delete listing and Keep it.
 * Request-time. The id from the link is checked before anything is built from it; an id that isn't one, another
 * shop's listing, or none, is the 404.
 */
export async function DeleteListing({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isId(id)) notFound();
  const owner = await requireShopOwner(deleteListingPath(id));
  const row = await getOwnListing(owner.shop.slug, id);
  if (!row) notFound();
  return (
    <>
      <div className="sell-item sell-item-alone">
        <ListingSummary row={row} />
      </div>
      <p>
        Buyers won&apos;t see it any more, and its photos are deleted. Conversations about it stay, with a note that it
        was removed. This can&apos;t be undone.
      </p>
      <form action={deleteListingForm} className="sell-form-buttons">
        <input type="hidden" name="listing" value={row.id} />
        <button type="submit" className="btn btn-danger">
          Delete listing
        </button>
        <Link href={myListingsPath(tabFor(row.state))} prefetch={false} className="link-button">
          Keep it
        </Link>
      </form>
    </>
  );
}
