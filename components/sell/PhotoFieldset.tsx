import { describedBy, FieldError } from "@/components/forms/FieldError";
import { PHOTO_ACCEPT, PHOTO_MAX_MB, PHOTOS_PER_LISTING, SHRINK_MAX_SIDE, SHRINK_QUALITY } from "@/lib/photos/rules";
import { PhotoField, type PhotoButton, type PhotoWords, type SavedPhoto } from "./PhotoField";

type PhotoFieldsetProps = {
  /** The form's id prefix (plan decision 23): "new" or "edit-<id>". */
  prefix: string;
  photos: readonly SavedPhoto[];
  /** The server's message about the photos, if any. */
  error: string | undefined;
};

/** Each photo's buttons (plan decision 9). The photo field shows those that apply where the photo is. */
const BUTTONS: readonly PhotoButton[] = [
  { op: "cover", label: "Make cover", className: "sell-action" },
  { op: "earlier", label: "Move earlier", className: "sell-action" },
  { op: "later", label: "Move later", className: "sell-action" },
  { op: "remove", label: "Remove", className: "sell-action sell-action-danger" },
];

/**
 * What the status line says after each action (sample words, plan decision 27): {n} is a number of photos, {at} a
 * photo's place and {max} the most a listing takes.
 */
const WORDS: PhotoWords = {
  cover: "That photo is the cover now.",
  moved: "Moved to photo {at} of {n}.",
  removed: "Photo removed. {n} left.",
  added: ["1 photo added.", "{n} photos added."],
  refused: ["1 wasn't a JPG, PNG or WebP.", "{n} weren't JPG, PNG or WebP."],
  leftOut: ["Only {max} photos fit, so 1 was left out.", "Only {max} photos fit, so {n} were left out."],
};

/**
 * The listing form's photos (selling spec 2.3, 2.5 and section 4; plan decisions 9 and 10). Everything that doesn't
 * change on the page is rendered here, on the server: the legend, the hints, the error, the file input's label and its
 * attributes, the buttons' and the status line's words, and how photos are shrunk. The photo field, the one client component, draws only the photos, the file input
 * and the status line, so its code stays small (spec section 5).
 */
export function PhotoFieldset({ prefix, photos, error }: PhotoFieldsetProps) {
  const inputId = `${prefix}-photos`;
  const hintId = `${inputId}-hint`;
  const errorId = `${inputId}-error`;
  return (
    <fieldset className="form-field sell-fieldset">
      <legend className="form-label">Photos</legend>
      <p id={hintId} className="form-hint">
        Up to {PHOTOS_PER_LISTING} JPG, PNG or WebP photos, {PHOTO_MAX_MB} MB each. The first is the cover. We make
        them smaller and remove hidden data such as your location. If someone else is in a photo, ask them first.
      </p>
      <FieldError id={errorId} message={error} />
      <PhotoField
        prefix={prefix}
        photos={photos}
        max={PHOTOS_PER_LISTING}
        shrinkTo={{ side: SHRINK_MAX_SIDE, quality: SHRINK_QUALITY }}
        buttons={BUTTONS}
        words={WORDS}
        altHint={
          // The photos' descriptions point here (PhotoField's `${prefix}-alt-hint`).
          <p id={`${prefix}-alt-hint`} className="form-hint">
            Describe each photo for people who can&apos;t see it. Leave it empty to use the title.
          </p>
        }
        input={{
          id: inputId,
          name: "newPhotos",
          accept: PHOTO_ACCEPT,
          "aria-invalid": error ? true : undefined,
          "aria-describedby": describedBy(hintId, error && errorId),
          className: "form-input sell-file",
        }}
      >
        <label htmlFor={inputId} className="form-label">
          Add photos
        </label>
      </PhotoField>
    </fieldset>
  );
}
