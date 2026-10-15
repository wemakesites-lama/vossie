import Link from "next/link";
import { myListingsPath, NEW_LISTING_PATH, PROFILE_PATH } from "@/lib/selling/paths";
import { longSastDate } from "@/lib/time";

type ShopWaitingProps = {
  shopName: string;
  /** When the application was sent, ISO 8601 in UTC. */
  sentAt: string;
};

/**
 * Waiting for approval (selling spec 2.7): what the Hub is doing, what happens next, and that listings can wait as
 * drafts. The words are samples for Lama to change (plan decision 27).
 */
export function ShopWaiting({ shopName, sentAt }: ShopWaitingProps) {
  return (
    <div className="sell-column">
      <header className="sell-head">
        <p className="eyebrow">Your shop</p>
        <h1 className="sell-title">The Hub is checking your shop</h1>
        <p className="sell-lede">
          You sent {shopName} for approval on {longSastDate(sentAt)}. The Hub will let you know here and in your
          notifications.
        </p>
      </header>

      <section aria-labelledby="sell-next-title" className="sell-section">
        <h2 id="sell-next-title" className="sell-section-title">
          What happens next
        </h2>
        <ol className="sell-cards sell-numbered">
          <li>The Hub looks at your shop&apos;s name, photo and what you&apos;ll sell.</li>
          <li>Once it&apos;s approved, you&apos;ll see it here and in your notifications.</li>
          <li>Your shop goes live, and you can publish your listings.</li>
        </ol>
      </section>

      <section aria-labelledby="sell-prepare-title" className="sell-section">
        <h2 id="sell-prepare-title" className="sell-section-title">
          Get your listings ready
        </h2>
        <p>
          You can prepare listings now. They&apos;re saved as drafts, which only you can see. Once your shop is
          approved, you publish them one by one.
        </p>
        <div className="sell-actions">
          <Link href={NEW_LISTING_PATH} prefetch={false} className="btn btn-primary">
            New listing
          </Link>
          <Link href={myListingsPath("drafts")} prefetch={false} className="btn btn-outline text-navy">
            Your drafts
          </Link>
          <Link href={PROFILE_PATH} prefetch={false} className="link-button">
            Edit your shop
          </Link>
        </div>
      </section>
    </div>
  );
}
