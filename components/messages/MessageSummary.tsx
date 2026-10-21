import Link from "next/link";
import type { ReactNode } from "react";
import { Photo } from "@/components/listings/Photo";
import { priceLabel } from "@/lib/format";
import type { ImageRef, Listing } from "@/lib/types";

type MessageSummaryProps = {
  /** The listing as it is now, or null for a question to the shop or a listing that has gone. */
  listing: Listing | null;
  /** The listing's title when the conversation started, for one that has gone (selling spec 9). */
  listingTitle: string | null;
  /** The shop; its slug is "" once it has gone ("A closed shop"), and its name is then shown without a link. */
  shop: { slug: string; name: string; image: ImageRef | null };
  campusName: string;
  /** Anything to show at the end of the card, such as the thread's status pill. */
  children?: ReactNode;
};

/**
 * What a conversation is about (messaging spec 3.1 and 3.3): the listing's photo, title, price, seller and campus; a
 * removed listing's title; or the shop, for a question to it (plan decision 2). The photo is decorative: the title
 * beside it says what it is.
 */
export function MessageSummary({ listing, listingTitle, shop, campusName, children }: MessageSummaryProps) {
  const image = listing ? listing.image : listingTitle ? null : shop.image;
  let text: ReactNode;
  if (listing) {
    text = (
      <>
        <Link href={`/listings/${listing.id}`} prefetch={false} className="msg-summary-title">
          {listing.title}
        </Link>
        <p className="msg-summary-meta">{`${priceLabel(listing)} · ${shop.name} · ${campusName}`}</p>
      </>
    );
  } else if (listingTitle) {
    text = (
      <>
        <p className="msg-summary-title">{listingTitle}</p>
        <p className="msg-summary-meta">This listing has been removed.</p>
      </>
    );
  } else {
    text = (
      <>
        {shop.slug ? (
          <Link href={`/sellers/${shop.slug}`} prefetch={false} className="msg-summary-title">
            {shop.name}
          </Link>
        ) : (
          <p className="msg-summary-title">{shop.name}</p>
        )}
        <p className="msg-summary-meta">{`A question for the shop · ${campusName}`}</p>
      </>
    );
  }
  return (
    <div className="msg-summary">
      {image && <Photo image={{ src: image.src, alt: "" }} ratio="1 / 1" sizes="72px" className="msg-summary-photo" />}
      <div className="msg-summary-text">{text}</div>
      {children}
    </div>
  );
}
