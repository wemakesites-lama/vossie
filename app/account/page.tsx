import type { Metadata } from "next";
import { Suspense } from "react";
import { AccountSkeleton } from "@/components/account/AccountSkeleton";
import { AccountView, detailsForm } from "@/components/account/AccountView";
import { DETAILS_FORM, readFormState } from "@/lib/auth/form-state";
import { requireAccount } from "@/lib/auth/session";
import { getCampuses } from "@/lib/data";
import { unreadCounts } from "@/lib/data/messages";

/** An account page belongs to one person, so search engines leave it out (accounts spec 3.3). */
export const metadata: Metadata = { title: "Your account", robots: { index: false } };

/**
 * Your account (accounts spec 3.2). The heading is prerendered; everything else needs the session, so it renders per
 * request inside <Suspense>. A signed-out visitor is sent to sign in, and comes back here afterwards (spec 2.10).
 */
export default function AccountPage() {
  return (
    <div className="page account-page">
      <h1 className="account-title">Your account</h1>
      <Suspense fallback={<AccountSkeleton />}>
        <AccountContent />
      </Suspense>
    </div>
  );
}

async function AccountContent() {
  const account = await requireAccount("/account");
  // requireAccount awaited connection() as it found the session, so the counts may read the clock (decision 26).
  const [campuses, state, counts] = await Promise.all([
    getCampuses(),
    readFormState(DETAILS_FORM),
    unreadCounts(account.id, new Date()),
  ]);
  return <AccountView account={account} campuses={campuses} details={detailsForm(account, state)} counts={counts} />;
}
