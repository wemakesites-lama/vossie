import Link from "next/link";
import { ErrorSummary } from "@/components/forms/ErrorSummary";
import { describedBy, FieldError } from "@/components/forms/FieldError";
import { errorFor, type FormError } from "@/lib/auth/messages";
import { listingFieldIds, listingFieldPrefix } from "@/lib/selling/errors";
import { saveListingForm } from "@/lib/selling/listing-actions";
import { myListingsPath, tabFor } from "@/lib/selling/paths";
import { CONDITION_CHOICES, HANDOVER_CHOICES, KIND_CHOICES, PAY_CHOICES } from "@/lib/selling/rules";
import type { Category, ListingState, PickupPoint } from "@/lib/types";
import { RadioGroup, SelectField, TextField } from "./fields";
import { PhotoField, type SavedPhoto } from "./PhotoField";

type ListingFormViewProps = {
  /** Null for a new listing. */
  listingId: string | null;
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
  /** A value that changes with every post (the form state's expiry), or nothing before the first. */
  round?: string;
};

/**
 * The listing form (selling spec 2.10, plan decision 26): every field of the listing model, always shown (nothing can
 * hide them without JavaScript), with hints saying which apply; the errors at the top and by each field; the photos;
 * and Save and publish (Save changes on a paused or sold listing) and Save as draft.
 */
export function ListingFormView(props: ListingFormViewProps) {
  const { listingId, state, waiting, values, photos, errors, categories, spots, campusName, round } = props;
  const prefix = listingFieldPrefix(listingId);
  const ids = listingFieldIds(prefix);
  const errorOf = (field: keyof typeof ids) => errorFor(errors, ids[field]);
  const priceError = errorOf("price");
  const publishLabel = state === "paused" || state === "sold" ? "Save changes" : "Save and publish";
  return (
    <>
      <ErrorSummary id={`${prefix}-summary`} errors={errors} />
      {waiting && (
        <p className="form-notice">
          Your shop is waiting for the Hub. Save your listing as a draft now, and publish it once your shop is
          approved.
        </p>
      )}
      <form action={saveListingForm} noValidate className="form-stack">
        {/* Enter in a field presses the form's first submit button, so a hidden copy of the save comes before any
            photo's buttons (which are submit buttons too). */}
        <button
          type="submit"
          name="intent"
          value={waiting ? "draft" : "publish"}
          tabIndex={-1}
          aria-hidden="true"
          className="sr-only"
        >
          Save
        </button>
        {listingId && <input type="hidden" name="listing" value={listingId} />}
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
        />
        <SelectField
          id={ids.category}
          name="category"
          label="Category"
          options={categories.map((category) => ({ value: category.slug, label: category.name }))}
          placeholder="Choose a category"
          defaultValue={values.category ?? ""}
          error={errorOf("category")}
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
        />
        <div className="form-field">
          <label htmlFor={ids.price} className="form-label">
            Price in rand
          </label>
          <p id={`${ids.price}-hint`} className="form-hint">
            Whole rand, such as 250. Leave it empty if you only swap.
          </p>
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
              aria-describedby={describedBy(`${ids.price}-hint`, priceError && `${ids.price}-error`)}
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
        {/* Keyed by every post and by the server's photos and descriptions: after a save that failed, the photos just
            uploaded come back as saved ones, and the field starts again from them rather than keeping files the form
            has already sent (or the server refused). React resets the form after a post, so each description's
            default must be the one just typed, which only a fresh field has. */}
        <PhotoField
          key={[round, ...photos.map((photo) => `${photo.src}\u0000${photo.alt}`)].join("\n")}
          prefix={prefix}
          photos={photos}
          error={errorOf("photos")}
        />
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
