import { describedBy, FieldError } from "@/components/forms/FieldError";
import {
  PHOTO_ACCEPT,
  PHOTO_MAX_MB,
  PHOTOS_PER_LISTING,
  POST_PHOTOS_MAX_BYTES,
  SHRINK_MAX_SIDE,
  SHRINK_PHOTO_BUDGET,
  SHRINK_QUALITIES,
  SHRINK_QUALITY,
} from "@/lib/photos/rules";
import { ALT_MAX } from "@/lib/selling/rules";
import { PhotoField, type PhotoButton, type PhotoParts, type PhotoWords, type SavedPhoto } from "./PhotoField";

type PhotoFieldsetProps = {
  /** The form's id prefix (plan decision 23): "new" or "edit-<id>". */
  prefix: string;
  photos: readonly SavedPhoto[];
  /** The server's message about the photos, if any. */
  error: string | undefined;
  /** The server's message about a description that's too long, shown above the photos (amendment 11.5). */
  altError: string | undefined;
  /** Photo-to-listing (spec 2.3): the fields the last fill filled in; a photo's description is `alt:<its address>`. */
  suggested?: ReadonlySet<string>;
};

/** What each photo's button posts without JavaScript: `photoMove`, with its value the photo and the move. */
const BUTTON = { type: "submit", name: "photoMove", className: "sell-action" } as const;

/** Each photo's buttons (plan decision 9). The photo field shows those that apply where the photo is. */
const BUTTONS: readonly PhotoButton[] = [
  { ...BUTTON, op: "cover", label: "Make cover" },
  { ...BUTTON, op: "earlier", label: "Move earlier" },
  { ...BUTTON, op: "later", label: "Move later" },
  { ...BUTTON, op: "remove", label: "Remove", className: "sell-action sell-action-danger" },
];

/**
 * What the status line says after each action (sample words, plan decision 27): {n} is a number of photos, {at} a
 * photo's place and {max} the most a listing takes. While picked photos are shrunk, it says so, then that they're
 * ready, for the last pick's number of photos (amendment 11.1), or that a save is waiting for them (amendment 13.3).
 */
const WORDS: PhotoWords = {
  cover: "That photo is the cover now.",
  moved: "Moved to photo {at} of {n}.",
  removed: "Photo removed. {n} left.",
  held: "Saving once your photos are ready…",
  added: ["1 photo added.", "{n} photos added."],
  refused: ["1 wasn't a JPG, PNG or WebP.", "{n} weren't JPG, PNG or WebP."],
  leftOut: ["Only {max} photos fit, so 1 was left out.", "Only {max} photos fit, so {n} were left out."],
  busy: ["Getting your photo ready…", "Getting your photos ready…"],
  ready: ["Your photo is ready.", "Your photos are ready."],
};

/**
 * The fixed attributes of the photo field's parts. The photos' descriptions point to the hint (`${prefix}-alt-hint`);
 * the one marked invalid, the first that's too long, points to the error as well (amendment 13.4).
 */
function photoParts(prefix: string, altError: string | undefined): PhotoParts {
  const hint = `${prefix}-alt-hint`;
  return {
    list: { className: "sell-photos" },
    photo: { className: "sell-photo" },
    hidden: { type: "hidden", name: "photo" },
    img: { width: 96, height: 96, className: "sell-thumb" },
    body: { className: "sell-photo-body" },
    title: { className: "sell-photo-title" },
    label: { className: "form-label" },
    alt: { type: "text", autoComplete: "off", "aria-describedby": hint, className: "form-input" },
    invalidAlt: { "aria-invalid": true, "aria-describedby": describedBy(hint, altError && `${prefix}-alt-error`) },
    buttons: { className: "sell-photo-buttons" },
    srOnly: { className: "sr-only" },
    status: { role: "status", className: "sell-photo-status" },
  };
}

/**
 * The listing form's photos (selling spec 2.3, 2.5 and section 4; plan decisions 9 and 10). Everything that doesn't
 * change on the page is rendered here, on the server: the legend, the hints, the errors, the file input's label and
 * its attributes, the buttons' words and attributes, every other part's attributes (photoParts), the status line's
 * words, and how photos are shrunk. The photo field, the one client component, draws only the photos, the file input
 * and the status line, so its code stays small (spec section 5). A photo button pressed without JavaScript comes back
 * to the legend (`${prefix}-photos-title`, amendment 11.4).
 */
export function PhotoFieldset({ prefix, photos, error, altError, suggested }: PhotoFieldsetProps) {
  const inputId = `${prefix}-photos`;
  // The photos whose description the fill wrote get the same "Suggested" tag as the other fields, inside their label,
  // after a space so it's read as its own word.
  const tagged = photos.filter((photo) => suggested?.has(`alt:${photo.src}`)).map((photo) => photo.src);
  const hintId = `${inputId}-hint`;
  const errorId = `${inputId}-error`;
  return (
    <fieldset className="form-field sell-fieldset">
      <legend id={`${inputId}-title`} className="form-label">
        Photos
      </legend>
      <p id={hintId} className="form-hint">
        Up to {PHOTOS_PER_LISTING} JPG, PNG or WebP photos, {PHOTO_MAX_MB} MB each. The first is the cover. We make
        them smaller and remove hidden data such as your location. If someone else is in a photo, ask them first.
      </p>
      {/* Without JavaScript the photos aren't made smaller before they're sent, and a save takes 4 MB of photos at
          most (Vercel's request body; C2/C3 plan decision 16). With it, each photo is shrunk to its share. */}
      <noscript>
        <p className="form-hint">
          Add a few photos at a time: the photos you add in one go can come to {POST_PHOTOS_MAX_BYTES / (1024 * 1024)} MB
          in all.
        </p>
      </noscript>
      <FieldError id={errorId} message={error} />
      <PhotoField
        prefix={prefix}
        photos={photos}
        max={PHOTOS_PER_LISTING}
        shrinkTo={{
          side: SHRINK_MAX_SIDE,
          quality: SHRINK_QUALITY,
          budget: SHRINK_PHOTO_BUDGET,
          qualities: SHRINK_QUALITIES,
        }}
        buttons={BUTTONS}
        words={WORDS}
        parts={photoParts(prefix, altError)}
        altTag={tagged.length > 0 ? { srcs: tagged, tag: <> <span className="field-tag">Suggested</span></> } : undefined}
        altHint={
          // The photos' descriptions point here (photoParts). A description that's too long is marked invalid and
          // points to the error too; the error summary links to it, and its message shows here, above the photos.
          <>
            <p id={`${prefix}-alt-hint`} className="form-hint">
              Describe each photo for people who can&apos;t see it. Leave it empty to use the title. Up to {ALT_MAX}{" "}
              characters.
            </p>
            <FieldError id={`${prefix}-alt-error`} message={altError} />
          </>
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
