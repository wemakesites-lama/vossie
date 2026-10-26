import type { Metadata } from "next";
import { AccountSkeleton } from "@/components/account/AccountSkeleton";
import { DetailsView, detailsForm } from "@/components/account/DetailsView";
import { PageTransition } from "@/components/kit/PageTransition";
import { Reveal } from "@/components/kit/Reveal";
import { Trail } from "@/components/ui/Trail";
import { DETAILS_FORM, readFormState } from "@/lib/auth/form-state";
import { requireAccount } from "@/lib/auth/session";
import { getCampuses } from "@/lib/data";
import { trailFor } from "@/lib/nav/trail";
import { DETAILS_PATH } from "@/lib/you/paths";

/** Like every account page, kept out of search engines (accounts spec 3.3; `/account` is in robots.txt too). */
export const metadata: Metadata = { title: "Your details", robots: { index: false } };

/**
 * Your details (role views spec 7.4): the heading and the way back are prerendered; the card and the form need the
 * session, so they render per request inside <Suspense>, and a signed-out visitor is sent to sign in first (spec 2.10).
 */
export default function DetailsPage() {
  return (
    <PageTransition>
      <div className="page account-page">
        <Trail crumbs={trailFor("/account/details")} />
        <h1 className="account-title">Your details</h1>
        <Reveal fallback={<AccountSkeleton />}>
          <DetailsContent />
        </Reveal>
      </div>
    </PageTransition>
  );
}

async function DetailsContent() {
  const account = await requireAccount(DETAILS_PATH);
  const [campuses, state] = await Promise.all([getCampuses(), readFormState(DETAILS_FORM)]);
  return <DetailsView account={account} campuses={campuses} details={detailsForm(account, state)} />;
}
