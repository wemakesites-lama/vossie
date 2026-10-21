import { ErrorSummary } from "@/components/forms/ErrorSummary";
import { describedBy, FieldError } from "@/components/forms/FieldError";
import { errorFor, type FormError } from "@/lib/auth/messages";
import type { PinView } from "@/lib/data/featured";
import { dayMonth } from "@/lib/format";
import { pinSeller, unpinSeller } from "@/lib/staff/admin-actions";
import { staffFieldIds } from "@/lib/staff/errors";
import { addDays, PIN_DAYS_AHEAD } from "@/lib/staff/rules";
import type { Seller } from "@/lib/types";
import { StaffTable } from "./StaffTable";

type Place = { slug: string; name: string };

type AdminFeaturedProps = {
  /** Today's SAST date, YYYY-MM-DD. */
  today: string;
  /** Each place's row today: "No campus chosen" first, then every campus. */
  rows: ReadonlyArray<{ campus: Place; sellers: readonly Seller[] }>;
  pins: readonly PinView[];
  /** Who can be pinned: Verified, open, with something listed. */
  choices: readonly Seller[];
  /** The signed-in admin's own shop would be a choice, and is left out: the field says so (stage L spec section 3). */
  ownLeftOut: boolean;
  places: readonly Place[];
  /** What was chosen before a failed pin. */
  values: Readonly<Record<string, string>>;
  errors: readonly FormError[];
};

const FIELDS = staffFieldIds("pin");

/**
 * Featured (spec 2.3 and 2.8, plan decision 9): each campus's row as its visitors see it today, the pin form, and the
 * pins from today on, each with Remove. The words are samples for Lama to change.
 */
export function AdminFeatured({ today, rows, pins, choices, ownLeftOut, places, values, errors }: AdminFeaturedProps) {
  const pinnedToday = new Set(pins.filter((pin) => pin.day === today).map((pin) => `${pin.campusSlug}:${pin.sellerSlug}`));
  const placeName = (slug: string) => places.find((place) => place.slug === slug)?.name ?? slug;
  const sellerError = errorFor(errors, FIELDS.seller);
  const campusError = errorFor(errors, FIELDS.campus);
  const dayError = errorFor(errors, FIELDS.day);
  return (
    <>
      <section aria-labelledby="admin-draw-title" className="staff-section">
        <h2 id="admin-draw-title" className="staff-section-title">
          Today&apos;s draw
        </h2>
        <p>
          Each campus&apos;s row as its visitors see it today, {dayMonth(today)}. Pins come first; the other places are
          the fair daily draw. A seller who has been featured sits out for a week when there are enough other Verified
          sellers to fill the row. When there aren&apos;t, the sellers featured longest ago come back first.
        </p>
        <StaffTable
          caption="Featured today, by campus"
          columns={["Campus", "Featured"]}
          rows={rows.map((row) => ({
            key: row.campus.slug,
            cells: [
              row.campus.name,
              row.sellers.length === 0
                ? "Nobody today"
                : row.sellers
                    .map((seller) =>
                      pinnedToday.has(`${row.campus.slug}:${seller.slug}`) ? `${seller.name} (pinned)` : seller.name,
                    )
                    .join(", "),
            ],
          }))}
          empty="No campuses."
        />
      </section>

      <section aria-labelledby="admin-pin-title" className="staff-section">
        <h2 id="admin-pin-title" className="staff-section-title">
          Pin a seller
        </h2>
        <p>
          A pinned seller takes one of the four places on that campus that day, before the draw. Only Verified sellers
          with an open shop and something listed can be pinned.
        </p>
        <ErrorSummary id="pin-summary" errors={errors} />
        <form action={pinSeller} noValidate className="form-stack staff-inline-form">
          <div className="form-field">
            <label htmlFor={FIELDS.seller} className="form-label">
              Seller
            </label>
            <FieldError id={`${FIELDS.seller}-error`} message={sellerError} />
            {ownLeftOut && (
              <p id={`${FIELDS.seller}-hint`} className="form-hint">
                Your own shop isn&apos;t in the list. Another admin can pin it.
              </p>
            )}
            <select
              id={FIELDS.seller}
              name="seller"
              required
              defaultValue={values.seller ?? ""}
              aria-invalid={sellerError ? true : undefined}
              aria-describedby={describedBy(ownLeftOut && `${FIELDS.seller}-hint`, sellerError && `${FIELDS.seller}-error`)}
              className="form-input form-select"
            >
              <option value="">Choose a Verified seller</option>
              {choices.map((seller) => (
                <option key={seller.slug} value={seller.slug}>
                  {seller.name}
                </option>
              ))}
            </select>
          </div>
          <div className="form-field">
            <label htmlFor={FIELDS.campus} className="form-label">
              Campus
            </label>
            <FieldError id={`${FIELDS.campus}-error`} message={campusError} />
            <select
              id={FIELDS.campus}
              name="campus"
              required
              defaultValue={values.campus ?? ""}
              aria-invalid={campusError ? true : undefined}
              aria-describedby={describedBy(campusError && `${FIELDS.campus}-error`)}
              className="form-input form-select"
            >
              <option value="">Choose a campus</option>
              {places.map((place) => (
                <option key={place.slug} value={place.slug}>
                  {place.name}
                </option>
              ))}
            </select>
          </div>
          <div className="form-field">
            <label htmlFor={FIELDS.day} className="form-label">
              Day
            </label>
            <p id={`${FIELDS.day}-hint`} className="form-hint">
              Today, or up to {PIN_DAYS_AHEAD} days ahead.
            </p>
            <FieldError id={`${FIELDS.day}-error`} message={dayError} />
            <input
              id={FIELDS.day}
              name="day"
              type="date"
              required
              min={today}
              max={addDays(today, PIN_DAYS_AHEAD)}
              defaultValue={values.day ?? today}
              aria-invalid={dayError ? true : undefined}
              aria-describedby={describedBy(`${FIELDS.day}-hint`, dayError && `${FIELDS.day}-error`)}
              className="form-input"
            />
          </div>
          <button type="submit" className="btn btn-primary form-submit">
            Pin the seller
          </button>
        </form>
      </section>

      <section aria-labelledby="admin-pins-title" className="staff-section">
        <h2 id="admin-pins-title" className="staff-section-title">
          Pins
        </h2>
        <StaffTable
          caption="Pins from today on, soonest first"
          columns={["Day", "Campus", "Seller", "Pinned by", "Remove"]}
          rows={pins.map((pin) => ({
            key: pin.id,
            cells: [
              dayMonth(pin.day),
              placeName(pin.campusSlug),
              pin.sellerName,
              pin.pinnedByName,
              pin.own ? (
                "Another admin must remove this pin."
              ) : (
                <form key="remove" action={unpinSeller}>
                  <input type="hidden" name="pin" value={pin.id} />
                  <button type="submit" className="staff-row-action staff-row-action-danger">
                    Remove{" "}
                    <span className="sr-only">
                      the pin for {pin.sellerName} at {placeName(pin.campusSlug)} on {dayMonth(pin.day)}
                    </span>
                  </button>
                </form>
              ),
            ],
          }))}
          empty="No pins from today on."
        />
      </section>
    </>
  );
}
