import { CampusSelect } from "@/components/forms/CampusSelect";
import { ErrorSummary } from "@/components/forms/ErrorSummary";
import { describedBy, FieldError } from "@/components/forms/FieldError";
import { updateDetails } from "@/lib/auth/actions";
import { DETAILS_FIELDS } from "@/lib/auth/form-state";
import { errorFor, formErrors, type FormError } from "@/lib/auth/messages";
import type { FormStateRow } from "@/lib/data/rows";
import { sastMonthYear } from "@/lib/time";
import type { Account, Campus, StaffRole } from "@/lib/types";

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

type DetailsViewProps = {
  account: Account;
  campuses: readonly Pick<Campus, "slug" | "name">[];
  details: DetailsForm;
};

/**
 * Your details (accounts spec 3.2, moved off You by role views spec 7.4): who you are, and Edit details. The same card
 * and form the account page had, on a page of their own.
 */
export function DetailsView({ account, campuses, details }: DetailsViewProps) {
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
    </div>
  );
}
