import { notFound } from "next/navigation";
import { connection } from "next/server";
import { readFormState } from "@/lib/auth/form-state";
import { requireAccount } from "@/lib/auth/session";
import { settleRequests } from "@/lib/data/requests";
import { offerFieldPrefix, offerFormKey, offerPath } from "@/lib/looking-for/paths";
import { offerStatus, offerSubject } from "@/lib/looking-for/subjects";
import { sastDate } from "@/lib/time";
import { OfferView, offerForm } from "./OfferView";

/**
 * The offer composer for this request's visitor (community actions spec 2.9). Request-time: the page puts it inside
 * <Suspense>. A hidden or unknown request is the 404, signed in or not; a signed-out visitor goes to sign-in and back.
 */
export async function Offer({ requestId }: { requestId: string }) {
  // Whether the request still takes offers reads the clock, and a due request's close is stored (stage L spec
  // decisions 11 and 14).
  await connection();
  const now = new Date();
  await settleRequests(now);
  const subject = await offerSubject(requestId);
  if (!subject) notFound();
  const account = await requireAccount(offerPath(requestId));
  const [status, state] = await Promise.all([
    offerStatus(subject, account, sastDate(now)),
    readFormState(offerFormKey(requestId)),
  ]);
  return <OfferView subject={subject} status={status} form={offerForm(state, offerFieldPrefix(requestId))} />;
}

/**
 * The composer's room while it streams in, sized to the open form a shop sees (E's `ComposerSkeleton` is the listing
 * composer's, and 366px short of this page on a phone): the back link and heading as E's skeleton has them, then the
 * same layout as the page, with the request's card, the form and the tips each at their measured height. Wordless.
 */
export function OfferSkeleton() {
  return (
    <div aria-hidden="true">
      <span className="skeleton composer-skeleton-crumb" />
      <span className="skeleton composer-skeleton-title" />
      <div className="composer-layout">
        <div className="composer-main">
          <span className="skeleton offer-skeleton-summary" />
          <span className="skeleton offer-skeleton-form" />
        </div>
        <span className="skeleton offer-skeleton-tips" />
      </div>
    </div>
  );
}
