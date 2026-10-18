import { ErrorSummary } from "@/components/forms/ErrorSummary";
import { describedBy, FieldError } from "@/components/forms/FieldError";
import { errorFor, type FormError } from "@/lib/auth/messages";
import { ONLINE_CAMPUS } from "@/lib/campus";
import type { PickupPointRow } from "@/lib/data/rows";
import { addPoint, renamePoint, restorePoint, retirePoint } from "@/lib/staff/admin-actions";
import { shortSastDate } from "@/lib/time";

type Place = { slug: string; name: string };
/** A form's typed name and errors after a failed post. */
export type PointForm = { name: string; errors: FormError[] };

type AdminPickupPointsProps = {
  campuses: readonly Place[];
  points: readonly PickupPointRow[];
  /** After a failed add, by campus slug. */
  addForms: Readonly<Record<string, PointForm>>;
  /** After a failed rename, by point id. */
  renameForms: Readonly<Record<string, PointForm>>;
};

function PointItem({ point, campusName, form }: { point: PickupPointRow; campusName: string; form?: PointForm }) {
  const fieldId = `point-${point.id}-name`;
  const error = form ? errorFor(form.errors, fieldId) : undefined;
  if (point.retiredAt) {
    return (
      <li className="staff-point">
        <p className="staff-point-name">
          {point.name}
          <span className="staff-muted"> · Retired on {shortSastDate(point.retiredAt)}</span>
        </p>
        <form action={restorePoint}>
          <input type="hidden" name="point" value={point.id} />
          <button type="submit" className="staff-row-action">
            Use {point.name} <span className="sr-only">at {campusName}</span> again
          </button>
        </form>
      </li>
    );
  }
  return (
    <li className="staff-point">
      <form action={renamePoint} noValidate className="staff-rename">
        <input type="hidden" name="point" value={point.id} />
        <label htmlFor={fieldId} className="form-label">
          New name for {point.name} <span className="sr-only">at {campusName}</span>
        </label>
        <FieldError id={`${fieldId}-error`} message={error} />
        <input
          id={fieldId}
          name="name"
          type="text"
          required
          defaultValue={form?.name ?? point.name}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(error && `${fieldId}-error`)}
          className="form-input"
        />
        <button type="submit" className="staff-row-action">
          Rename {point.name} <span className="sr-only">at {campusName}</span>
        </button>
      </form>
      <form action={retirePoint}>
        <input type="hidden" name="point" value={point.id} />
        <button type="submit" className="staff-row-action staff-row-action-danger">
          Retire {point.name} <span className="sr-only">at {campusName}</span>
        </button>
      </form>
    </li>
  );
}

function AddPoint({ campus, form }: { campus: Place; form?: PointForm }) {
  const fieldId = `point-add-${campus.slug}-name`;
  const error = form ? errorFor(form.errors, fieldId) : undefined;
  return (
    <form action={addPoint} noValidate className="staff-rename">
      <input type="hidden" name="campus" value={campus.slug} />
      <label htmlFor={fieldId} className="form-label">
        New pickup point at {campus.name}
      </label>
      <p id={`${fieldId}-hint`} className="form-hint">
        2 to 60 characters, and not a name {campus.name} has already.
      </p>
      <FieldError id={`${fieldId}-error`} message={error} />
      <input
        id={fieldId}
        name="name"
        type="text"
        required
        defaultValue={form?.name ?? ""}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(`${fieldId}-hint`, error && `${fieldId}-error`)}
        className="form-input"
      />
      <button type="submit" className="btn btn-outline text-navy">
        Add to {campus.name}
      </button>
    </form>
  );
}

/**
 * Pickup points (spec 2.3, plan decision 10): each campus's approved points, in use or retired, with Rename and Retire
 * (or Use it again), and a form to add one. Retiring loses nothing, so it has no confirm page. A failed post comes
 * back to its campus (`#points-<campus>`), where its error summary is.
 */
export function AdminPickupPoints({ campuses, points, addForms, renameForms }: AdminPickupPointsProps) {
  return (
    <>
      {campuses.map((campus) => {
        const own = points.filter((point) => point.campusSlug === campus.slug);
        const errors = [
          ...(addForms[campus.slug]?.errors ?? []),
          ...own.flatMap((point) => renameForms[point.id]?.errors ?? []),
        ];
        return (
          <section
            key={campus.slug}
            id={`points-${campus.slug}`}
            aria-labelledby={`points-${campus.slug}-title`}
            className="staff-section"
          >
            <h2 id={`points-${campus.slug}-title`} className="staff-section-title">
              {campus.name}
            </h2>
            {campus.slug === ONLINE_CAMPUS ? (
              <p>Eduvos Online has no pickup points: everything there happens online.</p>
            ) : (
              <>
                <ErrorSummary id={`points-${campus.slug}-summary`} errors={errors} />
                <ul className="staff-points">
                  {own.map((point) => (
                    <PointItem key={point.id} point={point} campusName={campus.name} form={renameForms[point.id]} />
                  ))}
                </ul>
                <AddPoint campus={campus} form={addForms[campus.slug]} />
              </>
            )}
          </section>
        );
      })}
    </>
  );
}
