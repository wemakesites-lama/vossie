import Link from "next/link";
import { CampusSelect } from "@/components/forms/CampusSelect";
import { ErrorSummary } from "@/components/forms/ErrorSummary";
import { describedBy, FieldError } from "@/components/forms/FieldError";
import { ChevronRightIcon } from "@/components/icons";
import { signOut, updateDetails } from "@/lib/auth/actions";
import { DETAILS_FIELDS } from "@/lib/auth/form-state";
import { errorFor, formErrors, type FormError } from "@/lib/auth/messages";
import type { FormStateRow } from "@/lib/data/rows";
import { AREA_HOME } from "@/lib/staff/paths";
import { staffAreasOf } from "@/lib/staff/roles";
import { sastMonthYear } from "@/lib/time";
import type { Account, Campus, StaffRole, UnreadCounts } from "@/lib/types";

export type DetailsForm = { firstName: string; campus: string; errors: FormError[]; saved: boolean };

/** Edit details' state: after a failed save, what was typed and what's wrong; otherwise the account's own details. */
export function detailsForm(account: Account, state: FormStateRow | null): DetailsForm {
  if (state && state.errors.length > 0) {
    return {
      firstName: state.values.firstName ?? account.firstName,
      campus: state.values.campus ?? account.campusSlug,
      errors: formErrors(state.errors, DETAILS_FIELDS),
      saved: false,
    };
  }
  return { firstName: account.firstName, campus: account.campusSlug, errors: [], saved: state?.notice === "saved" };
}

const ROLE_NAMES: Record<StaffRole, string> = { mentor: "Mentor", admin: "Admin" };

type AccountViewProps = {
  account: Account;
  campuses: readonly Pick<Campus, "slug" | "name">[];
  details: DetailsForm;
  /** Unread conversations and new notifications, for the first two rows (messaging spec 3.6). */
  counts: Pick<UnreadCounts, "conversations" | "notifications">;
};

/** Your account (accounts spec 3.2): who you are, Edit details, the account's pages, and Sign out. */
export function AccountView({ account, campuses, details, counts }: AccountViewProps) {
  const campusName = campuses.find((campus) => campus.slug === account.campusSlug)?.name ?? "None chosen";
  const nameError = errorFor(details.errors, DETAILS_FIELDS.firstName);
  const campusError = errorFor(details.errors, DETAILS_FIELDS.campus);
  return (
    <div className="account-body">
      <section aria-labelledby="account-you-title" className="account-card">
        <h2 id="account-you-title" className="account-name">
          {account.firstName}
        </h2>
        <dl className="account-facts">
          <div>
            <dt>Email</dt>
            <dd>{account.email}</dd>
          </div>
          <div>
            <dt>Campus</dt>
            <dd>{campusName}</dd>
          </div>
          {account.roles.length > 0 && (
            <div>
              <dt>Hub role</dt>
              <dd>{account.roles.map((role) => ROLE_NAMES[role]).join(" and ")}</dd>
            </div>
          )}
        </dl>
        <p className="account-since">Member since {sastMonthYear(account.createdAt)}</p>
      </section>

      <section aria-labelledby="account-edit-title" className="account-section">
        <h2 id="account-edit-title" className="account-section-title">
          Edit details
        </h2>
        {details.saved && (
          <p role="status" className="form-notice">
            Your details are saved.
          </p>
        )}
        <ErrorSummary id="account-details-summary" errors={details.errors} />
        <form action={updateDetails} noValidate className="form-stack">
          <div className="form-field">
            <label htmlFor={DETAILS_FIELDS.firstName} className="form-label">
              Your first name
            </label>
            <p id="details-first-name-hint" className="form-hint">
              Sellers see it when you message them. 2 to 40 characters.
            </p>
            <FieldError id="details-first-name-error" message={nameError} />
            <input
              id={DETAILS_FIELDS.firstName}
              name="firstName"
              type="text"
              autoComplete="given-name"
              required
              maxLength={40}
              defaultValue={details.firstName}
              aria-invalid={nameError ? true : undefined}
              aria-describedby={describedBy("details-first-name-hint", nameError && "details-first-name-error")}
              className="form-input"
            />
          </div>
          <div className="form-field">
            <label htmlFor={DETAILS_FIELDS.campus} className="form-label">
              Your campus
            </label>
            <FieldError id="details-campus-error" message={campusError} />
            <CampusSelect
              id={DETAILS_FIELDS.campus}
              defaultValue={details.campus}
              campuses={campuses}
              invalid={Boolean(campusError)}
              describedBy={describedBy(campusError && "details-campus-error")}
            />
          </div>
          <button type="submit" className="btn btn-primary form-submit">
            Save changes
          </button>
        </form>
      </section>

      <nav aria-label="Your account's pages">
        <ul className="account-rows">
          <li>
            <CountRow
              href="/messages"
              label="Messages"
              detail={counts.conversations > 0 ? `${counts.conversations} unread` : null}
            />
          </li>
          <li>
            <CountRow
              href="/notifications"
              label="Notifications"
              detail={counts.notifications > 0 ? `${counts.notifications} new` : null}
            />
          </li>
          <li>
            {/* No prefetch, as in the header: Saved's card chunk would load on every visit here. */}
            <Link href="/saved" prefetch={false} className="account-row">
              Saved
              <ChevronRightIcon />
            </Link>
          </li>
          <li>
            <SellingRow seller={account.seller} />
          </li>
          {/* Staff tools, by role, with no prefetch: every staff page reads the session (staff tools plan decision 19). */}
          {staffAreasOf(account).map((area) => (
            <li key={area}>
              <Link href={AREA_HOME[area].href} prefetch={false} className="account-row">
                {AREA_HOME[area].label}
                <ChevronRightIcon />
              </Link>
            </li>
          ))}
          <li>
            <Link href="/account/privacy" className="account-row">
              Privacy settings
              <ChevronRightIcon />
            </Link>
          </li>
        </ul>
      </nav>

      <form action={signOut}>
        <button type="submit" className="btn btn-outline text-navy">
          Sign out
        </button>
      </form>
    </div>
  );
}

/**
 * "Start selling" or "Your shop" (spec 3.2, plan decision 16). Stage F points them at /sell (selling plan decision 21).
 */
function SellingRow({ seller }: { seller: Account["seller"] }) {
  if (!seller) {
    return (
      <Link href="/sell" className="account-row">
        Start selling
        <ChevronRightIcon />
      </Link>
    );
  }
  const waiting = seller.status === "pending" || !seller.sellerSlug;
  let detail: string | null = null;
  if (waiting) detail = "Waiting for the Hub's approval";
  else if (seller.status === "paused") detail = "Paused";
  return (
    // Your shop's pages: the dashboard, or the waiting page (selling plan decision 21).
    <Link href="/sell" prefetch={false} className="account-row">
      <span>
        Your shop
        {detail && (
          <>
            <span className="sr-only">,</span> <span className="account-row-detail">{detail}</span>
          </>
        )}
      </span>
      <ChevronRightIcon />
    </Link>
  );
}

/** A row with a count under its name when there's something new (messaging spec 3.6), read as "Messages, 2 unread". */
function CountRow({ href, label, detail }: { href: string; label: string; detail: string | null }) {
  return (
    <Link href={href} prefetch={false} className="account-row">
      <span>
        {label}
        {detail && (
          <>
            <span className="sr-only">,</span> <span className="account-row-detail account-row-count">{detail}</span>
          </>
        )}
      </span>
      <ChevronRightIcon />
    </Link>
  );
}
