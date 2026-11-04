import Link from "next/link";
import { listingFieldIds } from "@/lib/selling/errors";
import { CONCERN_WORDS, type Concern } from "@/lib/selling/listing-check";

/**
 * "Check this before you publish" (AI features spec section 3): the guideline the listing check thinks the listing may
 * break, a way back to the title, and Publish anyway, which posts the form again with the concern (planning decision
 * 2). It sits inside the form after the hidden Save, so Enter in a field never publishes anyway. Like the composer's
 * scam check (components/messages/ScamCheck.tsx), it's an alert the browser focuses on a page load. No client code.
 * A paused or sold listing stays as it is on a save (`saving`), so its words say save, not publish.
 */
export function ListingCheck({ concern, prefix, saving = false }: { concern: Concern; prefix: string; saving?: boolean }) {
  const titleId = `${prefix}-check-title`;
  const verb = saving ? "save" : "publish";
  return (
    <div role="alert" tabIndex={-1} autoFocus aria-labelledby={titleId} className="msg-check">
      <h2 id={titleId} className="msg-check-title">
        Check this before you {verb}
      </h2>
      <p>
        This may break the seller guidelines: {CONCERN_WORDS[concern]}. If it doesn&apos;t, {verb} it anyway and the Hub
        will take a look.
      </p>
      <p className="msg-check-hint">
        <Link href="/seller-guidelines#guidelines-banned" prefetch={false}>
          What can&apos;t be sold
        </Link>
      </p>
      <div className="sell-form-buttons">
        <a href={`#${listingFieldIds(prefix).title}`} className="btn btn-outline text-navy">
          Edit listing
        </a>
        <button type="submit" name="anyway" value={concern} className="btn btn-primary">
          {saving ? "Save anyway" : "Publish anyway"}
        </button>
      </div>
    </div>
  );
}
