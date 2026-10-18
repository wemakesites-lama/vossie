import Link from "next/link";
import { PROFILE_PATH } from "@/lib/selling/paths";
import { sendForApprovalAgain } from "@/lib/selling/shop-actions";
import { longSastDate } from "@/lib/time";

type ShopDeclinedProps = {
  shopName: string;
  /** When the Hub declined it, ISO 8601 in UTC. */
  declinedAt: string;
  /** The Hub's reason, which the seller sees (staff tools plan decisions 2 and 18). */
  reason: string;
};

/**
 * A shop the Hub didn't approve yet (staff tools spec 2.3, plan decision 2): the Hub's reason, and what to do: change
 * the shop in Edit shop, then send it again. Its drafts are kept. The words are samples for Lama to change.
 */
export function ShopDeclined({ shopName, declinedAt, reason }: ShopDeclinedProps) {
  return (
    <div className="sell-column">
      <header className="sell-head">
        <p className="eyebrow">Your shop</p>
        <h1 className="sell-title">The Hub didn&apos;t approve your shop yet</h1>
        {/* One piece of text, as on the waiting page: a text node that starts mid-line counts as shifted when a font
            swap moves it to the next line. */}
        <p className="sell-lede">
          {`On ${longSastDate(declinedAt)} the Hub looked at ${shopName} and asked for a change before it opens.`}
        </p>
      </header>

      <section aria-labelledby="sell-declined-title" className="sell-section">
        <h2 id="sell-declined-title" className="sell-section-title">
          What the Hub said
        </h2>
        <blockquote className="staff-reason">{reason}</blockquote>
      </section>

      <section aria-labelledby="sell-again-title" className="sell-section">
        <h2 id="sell-again-title" className="sell-section-title">
          What to do next
        </h2>
        <p>Change what the Hub asked for in Edit shop, then send your shop again. Your drafts are kept.</p>
        <div className="sell-actions">
          <Link href={PROFILE_PATH} prefetch={false} className="btn btn-outline text-navy">
            Edit shop
          </Link>
          <form action={sendForApprovalAgain}>
            <button type="submit" className="btn btn-primary">
              Send for approval again
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}
