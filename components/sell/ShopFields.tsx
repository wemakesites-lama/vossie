import { CampusSelect } from "@/components/forms/CampusSelect";
import { describedBy, FieldError } from "@/components/forms/FieldError";
import { errorFor, type FormError } from "@/lib/auth/messages";
import { categoryPicture } from "@/lib/data/catalog";
import type { shopFieldIds } from "@/lib/selling/errors";
import { PHOTO_ACCEPT, PHOTO_MAX_MB } from "@/lib/photos/rules";
import type { Campus, Category, PickupPoint } from "@/lib/types";
import { CheckList, SelectField, TextField } from "./fields";
import { Thumb } from "./Thumb";

// The shop's fields (selling spec 2.6 and 2.11), shared by the wizard and Edit shop. Hints and wording are samples
// for Lama to change (plan decision 27).

type Ids = ReturnType<typeof shopFieldIds>;

export function NameFields({
  ids,
  errors,
  name,
  tagline,
  categorySlug,
  categories,
}: {
  ids: Ids;
  errors: readonly FormError[];
  name: string;
  tagline: string;
  categorySlug: string;
  categories: readonly Pick<Category, "slug" | "name">[];
}) {
  return (
    <>
      <TextField
        id={ids.name}
        name="name"
        label="Shop name"
        hint="2 to 60 characters. It can't be the same as another shop's name on your campus."
        defaultValue={name}
        error={errorFor(errors, ids.name)}
        required
      />
      <TextField
        id={ids.tagline}
        name="tagline"
        label="Tagline (optional)"
        hint="Up to 80 characters, such as “Braids and cornrows on campus.”"
        defaultValue={tagline}
        error={errorFor(errors, ids.tagline)}
      />
      <SelectField
        id={ids.category}
        name="category"
        label="Main category"
        options={categories.map((category) => ({ value: category.slug, label: category.name }))}
        placeholder="Choose a category"
        defaultValue={categorySlug}
        error={errorFor(errors, ids.category)}
      />
    </>
  );
}

export function AboutField({ ids, errors, about }: { ids: Ids; errors: readonly FormError[]; about: string }) {
  return (
    <TextField
      id={ids.about}
      name="about"
      label="About your shop"
      hint="Two or three sentences: what you sell, and how buyers find and pay you. Up to 600 characters. Line breaks are kept."
      defaultValue={about}
      error={errorFor(errors, ids.about)}
      required
      multiline
    />
  );
}

/**
 * The shop's photo (selling spec 2.6 step 3): the one it has, or its category's picture, and a file input. The server
 * checks and strips it (no client code here). `remove` is the wizard's Remove photo button or Edit shop's box, which
 * comes back ticked after a save that went wrong (`removeChecked`, amendment 13.6).
 */
export function ShopPhotoField({
  ids,
  errors,
  current,
  categorySlug,
  remove,
  removeChecked = false,
}: {
  ids: Ids;
  errors: readonly FormError[];
  /** The shop's photo's address ("/photos/…" or a sample's placeholder), or null for the category's picture. */
  current: string | null;
  categorySlug: string;
  remove: "button" | "checkbox";
  removeChecked?: boolean;
}) {
  const error = errorFor(errors, ids.photos);
  const picture = current ?? categoryPicture(categorySlug || "services").src;
  return (
    <div className="form-field">
      <div className="sell-photo-now">
        <Thumb src={picture} alt="" />
        <p>{current ? "Your shop's photo." : "No photo yet: buyers see your category's picture."}</p>
      </div>
      <label htmlFor={ids.photos} className="form-label">
        {current ? "A different photo (optional)" : "Shop photo (optional)"}
      </label>
      <p id={`${ids.photos}-hint`} className="form-hint">
        A JPG, PNG or WebP, up to {PHOTO_MAX_MB} MB. Hidden data such as your location is removed. If someone else is in
        it, ask them first.
      </p>
      <FieldError id={`${ids.photos}-error`} message={error} />
      <input
        id={ids.photos}
        name="photo"
        type="file"
        accept={PHOTO_ACCEPT}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(`${ids.photos}-hint`, error && `${ids.photos}-error`)}
        className="form-input sell-file"
      />
      {current && remove === "button" && (
        <button type="submit" name="photoAction" value="remove" className="link-button">
          Remove photo
        </button>
      )}
      {current && remove === "checkbox" && (
        <div className="form-check">
          <input
            id={`${ids.photos}-remove`}
            name="removePhoto"
            type="checkbox"
            value="yes"
            defaultChecked={removeChecked}
            className="form-checkbox"
          />
          <label htmlFor={`${ids.photos}-remove`}>Remove the photo and use my category&apos;s picture</label>
        </div>
      )}
    </div>
  );
}

/**
 * The campus and its pickup points (selling spec 2.6 step 4, plan decision 15). The points shown are `campusSlug`'s,
 * named in a hidden field, so choosing another campus comes back with that campus's points, with no client code.
 */
export function CampusSpotsFields({
  ids,
  errors,
  campusSlug,
  chosen,
  campuses,
  pickupPoints,
}: {
  ids: Ids;
  errors: readonly FormError[];
  campusSlug: string;
  chosen: readonly string[];
  campuses: readonly Pick<Campus, "slug" | "name">[];
  pickupPoints: readonly PickupPoint[];
}) {
  const campusError = errorFor(errors, ids.campus);
  const campusName = campuses.find((campus) => campus.slug === campusSlug)?.name ?? "";
  const spots = pickupPoints.filter((point) => point.campusSlug === campusSlug);
  return (
    <>
      <div className="form-field">
        <label htmlFor={ids.campus} className="form-label">
          Your campus
        </label>
        <p id={`${ids.campus}-hint`} className="form-hint">
          Choosing another? Press the button below, and its pickup points appear here.
        </p>
        <FieldError id={`${ids.campus}-error`} message={campusError} />
        <CampusSelect
          id={ids.campus}
          defaultValue={campusSlug}
          campuses={campuses}
          invalid={Boolean(campusError)}
          describedBy={describedBy(`${ids.campus}-hint`, campusError && `${ids.campus}-error`)}
        />
      </div>
      <input type="hidden" name="pointsCampus" value={campusSlug} />
      {spots.length > 0 ? (
        <CheckList
          id={ids.points}
          name="pickupPoint"
          legend={`Pickup points at ${campusName}`}
          hint="Where buyers can meet you. Choose at least one."
          options={spots.map((point) => ({ value: point.id, label: point.name }))}
          chosen={chosen}
          error={errorFor(errors, ids.points)}
        />
      ) : (
        campusSlug && (
          <p className="form-hint">
            {campusName || "This campus"} has no pickup points: you&apos;ll meet buyers online.
          </p>
        )
      )}
    </>
  );
}
