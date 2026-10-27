import Link from "next/link";
import { ErrorSummary } from "@/components/forms/ErrorSummary";
import { describedBy, FieldError } from "@/components/forms/FieldError";
import { errorFor, type FormError } from "@/lib/auth/messages";
import { listingFieldIds, listingFieldPrefix } from "@/lib/selling/errors";
import { saveListingForm } from "@/lib/selling/listing-actions";
import { noticeText } from "@/lib/selling/notices";
import { myListingsPath, tabFor } from "@/lib/selling/paths";
import { CONDITION_CHOICES, HANDOVER_CHOICES, KIND_CHOICES, PAY_CHOICES } from "@/lib/selling/rules";
import type { Category, ListingState, PickupPoint } from "@/lib/types";
import { RadioGroup, SelectField, TextField } from "./fields";
import type { SavedPhoto } from "./PhotoField";
import { PhotoFieldset } from "./PhotoFieldset";
import { PhotoStart } from "./PhotoStart";

type ListingFormViewProps = {
  /** Null for a new listing. */
  listingId: string | null;
  /** A new listing's one-time token, which makes it once however many times the form is sent (amendment 14.1). */
  once: string | null;
  /** The listing's state now, for the main button's words (plan decision 3). */
  state: ListingState | null;
  /** The shop is waiting for approval: drafts only (plan decision 4). */
  waiting: boolean;
  /** The fields' values: the listing's, a new one's defaults, or what was typed before a failed save. */
  values: Readonly<Record<string, string>>;
  photos: readonly SavedPhoto[];
  errors: readonly FormError[];
  categories: readonly Pick<Category, "slug" | "name">[];
  /** The shop's pickup spots. */
  spots: readonly PickupPoint[];
  campusName: string;
  // Photo-to-listing's props are optional (none means none), so the forms built elsewhere in tests need no change.
  /** Photo-to-listing (spec 2.1): null when the feature is off. Only a new listing passes it. */
  photoStart?: { on: boolean; limitReached: boolean } | null;
  /** The form's notice code (spec 2.3 and 2.4), or null. */
  notice?: string | null;
  /** The price hint (spec 2.3), or null. */
  priceHint?: string | null;
  /** The textbook Looking For line (spec 2.3), or null. */
  lookingFor?: { count: number; campusName: string; href: string } | null;
};

/**
 * The listing form (selling spec 2.10, plan decision 26): every field of the listing model, always shown (nothing can
 * hide them without JavaScript), with hints saying which apply; the errors at the top and by each field; the photos;
 * and Save and publish (Save changes on a paused or sold listing) and Save as draft. Every id starts with the form's
 * prefix, and the form is keyed by its listing, because Next keeps earlier pages in the DOM (amendments 1 to 3).
 */
export function ListingFormView(props: ListingFormViewProps) {
  const { listingId, once, state, waiting, values, photos, errors, categories, spots, campusName } = props;
  const { photoStart = null, notice = null, priceHint = null, lookingFor = null } = props;
  const prefix = listingFieldPrefix(listingId);
  // The photo marked invalid is the first whose description is too long, where that error links (amendment 11.5).
  const longAlt = photos.findIndex((photo) => photo.invalid);
  const ids = listingFieldIds(prefix, longAlt);
  const errorOf = (field: keyof typeof ids) => errorFor(errors, ids[field]);
  const priceError = errorOf("price");
  const publishLabel = state === "paused" || state === "sold" ? "Save changes" : "Save and publish";
  // Photo-to-listing (spec 2.3): the fields the last fill wrote, each tagged in its label, and how many there were.
  const suggested = new Set((values.suggested ?? "").split(" ").filter(Boolean));
  const tagOf = (field: string) => (suggested.has(field) ? "Suggested" : undefined);
  const noticeWords =
    notice === "suggested"
      ? `We filled in ${suggested.size} ${suggested.size === 1 ? "field" : "fields"} from your photo. Check each one before you publish.`
      : noticeText(notice);
  // The card is only on a new listing; the edit form keeps its photos last (spec 2.1, item 3).
  const withCard = photoStart?.on === true && listingId === null;
  // Keyed by the server's photos: after a save that failed, the photos just uploaded come back as saved ones, and the
  // field starts again from them rather than keeping files the form has already sent.
  const photoField = (
    <PhotoFieldset
      key={photos.map((photo) => photo.src).join(" ")}
      prefix={prefix}
      photos={photos}
      error={errorOf("photos")}
      altError={longAlt < 0 ? undefined : errorOf("alt")}
      suggested={suggested}
    />
  );
  return (
    <>
      <ErrorSummary id={`${prefix}-summary`} errors={errors} />
      {noticeWords && (
        <p role="status" className="form-notice">
          {noticeWords}
        </p>
      )}
      {lookingFor && (
        <p className="photo-start-looking">
          {`${lookingFor.count} ${lookingFor.count === 1 ? "student" : "students"} at ${lookingFor.campusName} ${lookingFor.count === 1 ? "is" : "are"} Looking For this. `}
          <Link href={lookingFor.href} prefetch={false}>
            See their requests
          </Link>
        </p>
      )}
      {waiting && (
        <p className="form-notice">
          Your shop is waiting for the Hub. Save your listing as a draft now, and publish it once your shop is
          approved.
        </p>
      )}
      <form key={listingId ?? "new"} action={saveListingForm} noValidate className="form-stack">
        {/* Enter in a field presses the form's first submit button, so a hidden copy of the save comes before any
            photo's buttons (which are submit buttons too). */}
        <button type="submit" name="intent" value={waiting ? "draft" : "publish"} tabIndex={-1} aria-hidden="true" className="sr-only">
          Save
        </button>
        {listingId && <input type="hidden" name="listing" value={listingId} />}
        {/* A server-drawn field, no script: only the first save that brings a token makes the listing. */}
        {!listingId && once && <input type="hidden" name="once" value={once} />}
        {withCard && (
          <>
            <PhotoStart prefix={prefix} limitReached={photoStart.limitReached}>
              {photoField}
            </PhotoStart>
            <p className="photo-start-or">or fill it in yourself</p>
          </>
        )}
        <RadioGroup
          id={ids.kind}
          name="kind"
          legend="What are you listing?"
          options={KIND_CHOICES}
          defaultValue={values.kind ?? ""}
          error={errorOf("kind")}
          row
        />
        <TextField
          id={ids.title}
          name="title"
          label="Title"
          hint="Up to 70 characters, such as “Casio fx-991ZA Plus calculator”."
          defaultValue={values.title ?? ""}
          error={errorOf("title")}
          required
          tag={tagOf("title")}
        />
        <SelectField
          id={ids.category}
          name="category"
          label="Category"
          options={categories.map((category) => ({ value: category.slug, label: category.name }))}
          placeholder="Choose a category"
          defaultValue={values.category ?? ""}
          error={errorOf("category")}
          tag={tagOf("category")}
        />
        <SelectField
          id={ids.condition}
          name="condition"
          label="Condition (items only)"
          hint="Leave it for a service."
          options={CONDITION_CHOICES}
          placeholder="Choose a condition"
          defaultValue={values.condition ?? ""}
          error={errorOf("condition")}
          required={false}
          tag={tagOf("condition")}
        />
        <div className="form-field">
          <label htmlFor={ids.price} className="form-label">
            Price in rand
          </label>
          <p id={`${ids.price}-hint`} className="form-hint">
            Whole rand, such as 250. Leave it empty if you only swap.
          </p>
          {priceHint && (
            <p id={`${ids.price}-suggest`} className="form-hint">
              {priceHint}
            </p>
          )}
          <FieldError id={`${ids.price}-error`} message={priceError} />
          <div className="sell-price">
            <span aria-hidden="true">R</span>
            <input
              id={ids.price}
              name="price"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              defaultValue={values.price ?? ""}
              aria-invalid={priceError ? true : undefined}
              aria-describedby={describedBy(`${ids.price}-hint`, priceHint && `${ids.price}-suggest`, priceError && `${ids.price}-error`)}
              className="form-input"
            />
          </div>
          <div className="form-check">
            <input
              id={`${prefix}-free`}
              name="free"
              type="checkbox"
              value="yes"
              defaultChecked={values.free === "yes"}
              className="form-checkbox"
            />
            <label htmlFor={`${prefix}-free`}>It&apos;s free</label>
          </div>
          <div className="form-check">
            <input
              id={`${prefix}-from`}
              name="from"
              type="checkbox"
              value="yes"
              defaultChecked={values.from === "yes"}
              className="form-checkbox"
            />
            <label htmlFor={`${prefix}-from`}>This is a starting price (services)</label>
          </div>
        </div>
        <RadioGroup
          id={ids.payMode}
          name="payMode"
          legend="How do you want to be paid?"
          options={PAY_CHOICES}
          defaultValue={values.payMode ?? ""}
          error={errorOf("payMode")}
          row
        />
        <TextField
          id={ids.swapFor}
          name="swapFor"
          label="What would you swap for?"
          hint="Only if you take swaps. Up to 200 characters, such as “a mechanical keyboard”."
          defaultValue={values.swapFor ?? ""}
          error={errorOf("swapFor")}
        />
        <TextField
          id={ids.description}
          name="description"
          label="Description"
          hint="What's included, sizes, how long it takes. Up to 1,000 characters. Line breaks are kept."
          defaultValue={values.description ?? ""}
          error={errorOf("description")}
          required
          multiline
          tag={tagOf("description")}
        />
        <RadioGroup
          id={ids.handover}
          name="handover"
          legend="How does it change hands?"
          hint={`At ${campusName}, your shop's campus.`}
          options={spots.length > 0 ? HANDOVER_CHOICES : HANDOVER_CHOICES.slice(1)}
          defaultValue={values.handover ?? ""}
          error={errorOf("handover")}
        />
        {spots.length > 0 && (
          <SelectField
            id={ids.pickup}
            name="pickup"
            label="Pickup point"
            hint="For a pickup: where buyers collect it."
            options={spots.map((spot) => ({ value: spot.id, label: spot.name }))}
            placeholder="Choose a point"
            defaultValue={values.pickup ?? ""}
            error={errorOf("pickup")}
            required={false}
          />
        )}
        {!withCard && photoField}
        <div className="sell-form-buttons">
          {!waiting && (
            <button type="submit" name="intent" value="publish" className="btn btn-primary form-submit">
              {publishLabel}
            </button>
          )}
          <button
            type="submit"
            name="intent"
            value="draft"
            className={waiting ? "btn btn-primary form-submit" : "btn btn-outline text-navy"}
          >
            Save as draft
          </button>
          <Link href={myListingsPath(state ? tabFor(state) : "available")} prefetch={false} className="link-button">
            Cancel
          </Link>
        </div>
      </form>
    </>
  );
}
