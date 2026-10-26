import type { Metadata } from "next";
import { AccountSkeleton } from "@/components/account/AccountSkeleton";
import { PrivacySettingsView } from "@/components/account/PrivacySettingsView";
import { PageTransition } from "@/components/kit/PageTransition";
import { Reveal } from "@/components/kit/Reveal";
import { Trail } from "@/components/ui/Trail";
import { DELETE_FIELDS, DELETE_FORM, readFormState } from "@/lib/auth/form-state";
import { formErrors } from "@/lib/auth/messages";
import { requireAccount } from "@/lib/auth/session";
import { getLatestConsent } from "@/lib/data/accounts";
import { listReportsBy } from "@/lib/data/reports";
import { countAdmins } from "@/lib/data/staff-accounts";
import { trailFor } from "@/lib/nav/trail";

/** Like every account page, kept out of search engines (accounts spec 3.3). */
export const metadata: Metadata = { title: "Privacy settings", robots: { index: false } };

/**
 * Privacy settings (accounts spec 3.3). The heading and the way back are prerendered; the rest needs the session, so it
 * renders per request inside <Suspense>, and a signed-out visitor is sent to sign in first (spec 2.10).
 */
export default function PrivacySettingsPage() {
  return (
    <PageTransition>
      <div className="page account-page">
        <Trail crumbs={trailFor("/account/privacy")} />
        <h1 className="account-title">Privacy settings</h1>
        <Reveal fallback={<AccountSkeleton />}>
          <PrivacySettings />
        </Reveal>
      </div>
    </PageTransition>
  );
}

async function PrivacySettings() {
  const account = await requireAccount("/account/privacy");
  const [consent, state, reports] = await Promise.all([
    getLatestConsent(account.id),
    readFormState(DELETE_FORM),
    listReportsBy(account.id),
  ]);
  // Staff see what happens to their work; Vossie's only admin is warned (stage J spec decision 8).
  const staff =
    account.roles.length > 0 ? { onlyAdmin: account.roles.includes("admin") && (await countAdmins()) === 1 } : null;
  return (
    <PrivacySettingsView
      consent={consent}
      deleteErrors={formErrors(state?.errors ?? [], DELETE_FIELDS)}
      reports={reports}
      staff={staff}
    />
  );
}
