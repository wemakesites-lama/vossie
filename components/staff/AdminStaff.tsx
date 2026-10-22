import Link from "next/link";
import { ErrorSummary } from "@/components/forms/ErrorSummary";
import { describedBy, FieldError } from "@/components/forms/FieldError";
import { errorFor, type FormError } from "@/lib/auth/messages";
import type { StaffAccount } from "@/lib/data/staff-accounts";
import { giveStaffRole } from "@/lib/staff/account-actions";
import { GIVE_ROLE_FIELDS } from "@/lib/staff/errors";
import { removeRolePath } from "@/lib/staff/paths";
import { ROLE_CHOICES, rolesText } from "@/lib/staff/roles";
import type { StaffRole } from "@/lib/types";
import { StaffTable } from "./StaffTable";

type AdminStaffProps = {
  people: readonly StaffAccount[];
  /** The signed-in admin: their own admin role has no Remove link (spec decision 5). */
  viewerId: string;
  /** Who mentors the signed-in admin's own shop: their mentor role has no Remove link (stage M spec decision 6). */
  ownShopMentorId: string | null;
  campusNames: ReadonlyMap<string, string>;
  /** What was typed and chosen before a failed Give role. */
  values: Readonly<Record<string, string>>;
  errors: readonly FormError[];
  /** Give role's one-time token (staff tools amendment 15.7), or null, when a send is refused as out of date. */
  once: string | null;
};

/** "1", "0", or "None" for an admin who isn't a mentor and mentors none (spec decision 2, plan decision 11). */
export function mentoredText(person: Pick<StaffAccount, "roles" | "mentors">): string {
  if (person.mentors.length === 0 && !person.roles.includes("mentor")) return "None";
  return String(person.mentors.length);
}

function RemoveLink({ person, role }: { person: StaffAccount; role: StaffRole }) {
  return (
    <Link href={removeRolePath(person.id, role)} prefetch={false} className="staff-row-action staff-row-action-danger">
      Remove {role} role{" "}
      <span className="sr-only">{`for ${person.firstName}`}</span>
    </Link>
  );
}

/**
 * One link per role. The admin's own admin role says "This is you." instead (spec decision 5), and the mentor role of
 * whoever mentors the admin's own shop says "Mentors your shop." (stage M spec decision 6).
 */
function RowActions({
  person,
  viewerId,
  ownShopMentorId,
}: {
  person: StaffAccount;
  viewerId: string;
  ownShopMentorId: string | null;
}) {
  return (
    <div className="staff-row-actions">
      {person.roles.map((role) => {
        if (role === "admin" && person.id === viewerId) {
          return (
            <span key={role} className="staff-muted">
              This is you.
            </span>
          );
        }
        if (role === "mentor" && person.id === ownShopMentorId) {
          return (
            <span key={role} className="staff-muted">
              Mentors your shop.
            </span>
          );
        }
        return <RemoveLink key={role} person={person} role={role} />;
      })}
    </div>
  );
}

/** Give a staff role (spec decision 3): the exact email and a role, never a search, a suggestion or a list. */
function GiveRoleForm({ values, errors, once }: Pick<AdminStaffProps, "values" | "errors" | "once">) {
  const emailError = errorFor(errors, GIVE_ROLE_FIELDS.email);
  const roleError = errorFor(errors, GIVE_ROLE_FIELDS.role);
  const emailHint = `${GIVE_ROLE_FIELDS.email}-hint`;
  const emailErrorId = `${GIVE_ROLE_FIELDS.email}-error`;
  return (
    <section aria-labelledby="admin-staff-give-title" className="staff-section">
      <h2 id="admin-staff-give-title" className="staff-section-title">
        Give a staff role
      </h2>
      <ErrorSummary id="give-role-problems" errors={errors} />
      <form action={giveStaffRole} noValidate className="form-stack staff-inline-form">
        {once && <input type="hidden" name="once" value={once} />}
        <div className="form-field">
          <label htmlFor={GIVE_ROLE_FIELDS.email} className="form-label">
            Eduvos email
          </label>
          <p id={emailHint} className="form-hint">
            The email they sign in with. They need to have signed in to CampusCart once.
          </p>
          <FieldError id={emailErrorId} message={emailError} />
          <input
            id={GIVE_ROLE_FIELDS.email}
            name="email"
            type="email"
            autoComplete="off"
            required
            defaultValue={values.email ?? ""}
            aria-invalid={emailError ? true : undefined}
            aria-describedby={describedBy(emailHint, emailError && emailErrorId)}
            className="form-input"
          />
        </div>
        <fieldset className="form-field" aria-describedby={describedBy(roleError && "give-role-role-error")}>
          <legend className="form-label">Role</legend>
          <FieldError id="give-role-role-error" message={roleError} />
          {ROLE_CHOICES.map((choice) => {
            const radioId = `give-role-role-${choice.role}`;
            return (
              <div key={choice.role} className="staff-radio">
                <div className="form-check">
                  <input
                    id={radioId}
                    type="radio"
                    name="role"
                    value={choice.role}
                    required
                    defaultChecked={values.role === choice.role}
                    aria-describedby={`${radioId}-hint`}
                    className="form-checkbox"
                  />
                  <label htmlFor={radioId}>{choice.label}</label>
                </div>
                <p id={`${radioId}-hint`} className="form-hint staff-radio-hint">
                  {choice.hint}
                </p>
              </div>
            );
          })}
        </fieldset>
        <button type="submit" className="btn btn-primary form-submit">
          Give role
        </button>
      </form>
    </section>
  );
}

/**
 * Staff accounts (spec decisions 2 and 3): everyone with a role, and no one else, then the Give a staff role form (role
 * views spec 7.2). The
 * email is shown because roles are given by email and two staff may share a first name. Server-rendered, with no
 * client code. The words are samples for Lama to change.
 */
export function AdminStaff({ people, viewerId, ownShopMentorId, campusNames, values, errors, once }: AdminStaffProps) {
  return (
    <>
      <section aria-labelledby="admin-staff-list-title" className="staff-section">
        <h2 id="admin-staff-list-title" className="staff-section-title">
          Who has a role
        </h2>
        <p className="staff-muted">
          Only people with a staff role are listed. Roles aren&apos;t tied to a campus: each person&apos;s campus is the
          one they chose.
        </p>
        <StaffTable
          caption={`Staff accounts (${people.length})`}
          columns={["Name", "Email", "Campus", "Roles", "Shops they mentor", "Change"]}
          rows={people.map((person) => ({
            key: person.id,
            cells: [
              person.firstName,
              person.email,
              campusNames.get(person.campusSlug) ?? person.campusSlug,
              rolesText(person.roles),
              mentoredText(person),
              <RowActions key="change" person={person} viewerId={viewerId} ownShopMentorId={ownShopMentorId} />,
            ],
          }))}
          empty="No one has a staff role."
        />
      </section>
      <GiveRoleForm values={values} errors={errors} once={once} />
    </>
  );
}
