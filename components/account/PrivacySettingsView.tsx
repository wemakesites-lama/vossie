import Link from "next/link";
import type { ReactNode } from "react";
import { ErrorSummary } from "@/components/forms/ErrorSummary";
import { describedBy, FieldError } from "@/components/forms/FieldError";
import { deleteAccount } from "@/lib/auth/actions";
import { policyLabel } from "@/lib/auth/config";
import { DELETE_FIELDS } from "@/lib/auth/form-state";
import { errorFor, type FormError } from "@/lib/auth/messages";
import { reasonLabel } from "@/lib/messaging/rules";
import { longSastDate, sastClock, shortSastDate } from "@/lib/time";
import type { Consent, ReportSummary } from "@/lib/types";

type PrivacySettingsViewProps = {
  consent: Consent | null;
  deleteErrors: readonly FormError[];
  /** The account's reports, newest first (messaging plan decision 18). */
  reports: readonly ReportSummary[];
};

/** Privacy settings (accounts spec 3.3): the consent record, the download, and deleting the account (spec 2.13). */
export function PrivacySettingsView({ consent, deleteErrors, reports }: PrivacySettingsViewProps) {
  const confirmError = errorFor(deleteErrors, DELETE_FIELDS.confirm);
  let consentLine: ReactNode;
  if (consent) {
    consentLine = (
      <p>
        You agreed to the <Link href="/privacy">privacy policy</Link> ({policyLabel(consent.version)}) on{" "}
        {longSastDate(consent.agreedAt)} at {sastClock(consent.agreedAt)}.
      </p>
    );
  } else {
    consentLine = (
      <p>There&apos;s no record of you agreeing to the privacy policy. You&apos;ll be asked when you next sign in.</p>
    );
  }
  return (
    <div className="account-body">
      <section aria-labelledby="account-privacy-consent-title" className="account-section">
        <h2 id="account-privacy-consent-title" className="account-section-title">
          Your consent
        </h2>
        {consentLine}
      </section>

      <section aria-labelledby="account-privacy-download-title" className="account-section">
        <h2 id="account-privacy-download-title" className="account-section-title">
          Download your data
        </h2>
        <p>
          A file of what Vossie holds about you: your account, your consent, when you signed in, your conversations,
          your reports and your notifications. Once selling opens, it will hold your listings too.
        </p>
        {/* A file from a route handler, not a page, so a plain link. */}
        <p>
          <a href="/account/privacy/export" download="vossie-data.json" className="btn btn-outline text-navy">
            Download your data
          </a>
        </p>
      </section>

      <section aria-labelledby="account-privacy-reports-title" className="account-section">
        <h2 id="account-privacy-reports-title" className="account-section-title">
          Reports you&apos;ve made
        </h2>
        {reports.length === 0 ? (
          <p>You haven&apos;t reported anything.</p>
        ) : (
          <ul className="account-reports">
            {reports.map((report) => (
              <li key={`${report.kind}:${report.title}:${report.createdAt}`}>
                <span className="account-report-title">{report.title}</span>{" "}
                <span className="account-report-meta">
                  {`${reasonLabel(report.reason)} · ${shortSastDate(report.createdAt)} · ${report.open ? "Open" : "Closed"}`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="account-privacy-delete-title" className="account-section account-delete">
        <h2 id="account-privacy-delete-title" className="account-section-title">
          Delete your account
        </h2>
        <p>It happens straight away, and it can&apos;t be undone:</p>
        <ul>
          <li>your account goes: your email address, first name and campus;</li>
          <li>you&apos;re signed out on every device;</li>
          <li>your record of consent goes;</li>
          <li>
            your messages, reports and notifications go, and the other person keeps only their own side of each
            conversation;
          </li>
          <li>once selling opens, your shop and listings go too.</li>
        </ul>
        <p>Saved listings stay on this device until you clear them.</p>
        <ErrorSummary id="account-privacy-delete-summary" errors={deleteErrors} />
        <form action={deleteAccount} noValidate className="form-stack">
          <div className="form-field">
            <FieldError id="delete-confirm-error" message={confirmError} />
            <div className="form-check">
              <input
                id={DELETE_FIELDS.confirm}
                name="confirm"
                type="checkbox"
                value="yes"
                required
                aria-invalid={confirmError ? true : undefined}
                aria-describedby={describedBy(confirmError && "delete-confirm-error")}
                className="form-checkbox"
              />
              <label htmlFor={DELETE_FIELDS.confirm}>I understand this can&apos;t be undone</label>
            </div>
          </div>
          <button type="submit" className="btn btn-danger form-submit">
            Delete my account
          </button>
        </form>
      </section>
    </div>
  );
}
