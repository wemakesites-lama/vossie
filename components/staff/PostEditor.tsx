import { ErrorSummary } from "@/components/forms/ErrorSummary";
import { describedBy, FieldError } from "@/components/forms/FieldError";
import { Markdown } from "@/components/hub/Markdown";
import { errorFor, type FormError } from "@/lib/auth/messages";
import { ALL_CAMPUSES } from "@/lib/campus";
import type { HubPostRow } from "@/lib/data/rows";
import { PHOTO_ACCEPT, PHOTO_MAX_MB } from "@/lib/photos/rules";
import { postFieldIds } from "@/lib/staff/errors";
import { postPrefix } from "@/lib/staff/form-state";
import { savePost } from "@/lib/staff/hub-actions";
import { POST_KINDS, POST_SUMMARY_MAX, POST_TITLE_MAX, utcToSastFields } from "@/lib/staff/post-rules";

/** A new post's starting values: a published tip for every campus. */
export const NEW_POST_VALUES: Readonly<Record<string, string>> = { kind: "tip", campus: ALL_CAMPUSES, published: "yes" };

/** A post as the editor's values, its date and time in SAST. */
export function postValues(row: HubPostRow): Record<string, string> {
  const when = row.startsAt ? utcToSastFields(row.startsAt) : { date: "", time: "" };
  return {
    kind: row.kind,
    title: row.title,
    campus: row.campusSlug,
    date: when.date,
    time: when.time,
    place: row.place ?? "",
    capacity: row.capacity === null ? "" : String(row.capacity),
    summary: row.summary,
    body: row.body,
    published: row.published ? "yes" : "",
    cover: "",
  };
}

type FieldProps = {
  id: string;
  name: string;
  label: string;
  hint?: string;
  value: string;
  errors: readonly FormError[];
  type?: "text" | "date" | "time";
  inputMode?: "numeric";
  required?: boolean;
};

function Field({ id, name, label, hint, value, errors, type = "text", inputMode, required = false }: FieldProps) {
  const error = errorFor(errors, id);
  return (
    <div className="form-field">
      <label htmlFor={id} className="form-label">
        {label}
      </label>
      {hint && (
        <p id={`${id}-hint`} className="form-hint">
          {hint}
        </p>
      )}
      <FieldError id={`${id}-error`} message={error} />
      <input
        id={id}
        name={name}
        type={type}
        inputMode={inputMode}
        required={required}
        defaultValue={value}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(hint && `${id}-hint`, error && `${id}-error`)}
        className="form-input"
      />
    </div>
  );
}

type PostEditorProps = {
  /** Null for a new post. */
  postId: string | null;
  values: Readonly<Record<string, string>>;
  errors: readonly FormError[];
  /** The body as typed when Preview was pressed, rendered above the form; null otherwise. */
  preview: string | null;
  campuses: readonly { slug: string; name: string }[];
  /** The post's cover now, or null for a new post. */
  coverSrc: string | null;
  /** A new post's one-time token, which makes it once however many times the form is sent (amendment 15.7). */
  once?: string | null;
};

/**
 * The Hub's post editor (spec 2.4; plan decisions 11 and 12): the kind, title, campus or all, date and start time
 * (SAST), place, places (events), summary, the body (the markdown subset), a cover photo and Published. Every field
 * shows whatever the kind, since nothing can hide them without JavaScript; hints say which apply. Preview draws the
 * body on the server, above the form; Save checks everything. A plain form, so it works without the app's JavaScript.
 */
export function PostEditor({ postId, values, errors, preview, campuses, coverSrc, once = null }: PostEditorProps) {
  const prefix = postPrefix(postId);
  const ids = postFieldIds(prefix);
  const kindError = errorFor(errors, ids.kind);
  const campusError = errorFor(errors, ids.campus);
  const bodyError = errorFor(errors, ids.body);
  const coverError = errorFor(errors, ids.photos);
  return (
    <>
      {preview !== null && (
        <section id={`${prefix}-preview`} aria-labelledby={`${prefix}-preview-title`} className="staff-section staff-preview">
          <h2 id={`${prefix}-preview-title`} className="staff-section-title">
            Preview
          </h2>
          {preview.trim() === "" ? (
            <p className="staff-muted">There is nothing to preview yet.</p>
          ) : (
            <Markdown source={preview} headingLevel={3} />
          )}
        </section>
      )}

      {/* Not "-summary": that is the Summary field's id. */}
      <ErrorSummary id={`${prefix}-problems`} errors={errors} />
      <form action={savePost} noValidate className="form-stack staff-editor">
        <input type="hidden" name="post" value={postId ?? ""} />
        {postId === null && once && <input type="hidden" name="once" value={once} />}

        <fieldset className="form-field" aria-describedby={describedBy(kindError && `${prefix}-kind-error`)}>
          <legend className="form-label">Kind</legend>
          <FieldError id={`${prefix}-kind-error`} message={kindError} />
          {POST_KINDS.map((kind) => {
            const radioId = `${prefix}-kind-${kind.value}`;
            return (
              <div key={kind.value} className="staff-radio">
                <div className="form-check">
                  <input
                    id={radioId}
                    type="radio"
                    name="kind"
                    value={kind.value}
                    defaultChecked={values.kind === kind.value}
                    aria-describedby={`${radioId}-hint`}
                    className="form-checkbox"
                  />
                  <label htmlFor={radioId}>{kind.label}</label>
                </div>
                <p id={`${radioId}-hint`} className="form-hint staff-radio-hint">
                  {kind.hint}
                </p>
              </div>
            );
          })}
        </fieldset>

        <Field
          id={ids.title}
          name="title"
          label="Title"
          hint={`Up to ${POST_TITLE_MAX} characters.`}
          value={values.title ?? ""}
          errors={errors}
          required
        />

        <div className="form-field">
          <label htmlFor={ids.campus} className="form-label">
            Campus
          </label>
          <p id={`${ids.campus}-hint`} className="form-hint">
            Tips are for every campus.
          </p>
          <FieldError id={`${ids.campus}-error`} message={campusError} />
          <select
            id={ids.campus}
            name="campus"
            defaultValue={values.campus ?? ALL_CAMPUSES}
            aria-invalid={campusError ? true : undefined}
            aria-describedby={describedBy(`${ids.campus}-hint`, campusError && `${ids.campus}-error`)}
            className="form-input form-select"
          >
            <option value={ALL_CAMPUSES}>All campuses</option>
            {campuses.map((campus) => (
              <option key={campus.slug} value={campus.slug}>
                {campus.name}
              </option>
            ))}
          </select>
        </div>

        <Field
          id={ids.date}
          name="date"
          label="Date"
          hint="Events and office hours only. A new date must not have passed."
          value={values.date ?? ""}
          errors={errors}
          type="date"
        />
        <Field
          id={ids.time}
          name="time"
          label="Start time"
          hint="South African time, like 13:00."
          value={values.time ?? ""}
          errors={errors}
          type="time"
        />
        <Field
          id={ids.place}
          name="place"
          label="Place"
          hint="Events and office hours only, like The Hub, Block C."
          value={values.place ?? ""}
          errors={errors}
        />
        <Field
          id={ids.capacity}
          name="capacity"
          label="Places (events only)"
          hint="How many can come, from 1 to 1,000."
          value={values.capacity ?? ""}
          errors={errors}
          inputMode="numeric"
        />
        <Field
          id={ids.summary}
          name="summary"
          label="Summary"
          hint={`One sentence for cards and link previews, up to ${POST_SUMMARY_MAX} characters.`}
          value={values.summary ?? ""}
          errors={errors}
          required
        />

        <div className="form-field">
          <label htmlFor={ids.body} className="form-label">
            The post
          </label>
          <p id={`${ids.body}-hint`} className="form-hint">
            Up to 4,000 characters. **Bold**, *italic*, ## headings, lists starting with - or 1., and [links](/hub) to
            pages on CampusCart.
          </p>
          <FieldError id={`${ids.body}-error`} message={bodyError} />
          <textarea
            id={ids.body}
            name="body"
            rows={12}
            required
            defaultValue={values.body ?? ""}
            aria-invalid={bodyError ? true : undefined}
            aria-describedby={describedBy(`${ids.body}-hint`, bodyError && `${ids.body}-error`)}
            className="form-input staff-textarea"
          />
        </div>

        <div className="form-field">
          <label htmlFor={ids.photos} className="form-label">
            Cover photo (optional)
          </label>
          <p id={`${ids.photos}-hint`} className="form-hint">
            A JPG, PNG or WebP, up to {PHOTO_MAX_MB} MB. Without one, the post shows the Hub&apos;s banner.
          </p>
          <FieldError id={`${ids.photos}-error`} message={coverError} />
          <input
            id={ids.photos}
            name="cover"
            type="file"
            accept={PHOTO_ACCEPT}
            aria-invalid={coverError ? true : undefined}
            aria-describedby={describedBy(`${ids.photos}-hint`, coverError && `${ids.photos}-error`)}
            className="form-input"
          />
          {values.cover ? (
            <p className="form-hint">
              <input type="hidden" name="keepCover" value={values.cover} />A new cover is ready (
              <a href={values.cover}>see it</a>). It&apos;s saved with the post.
            </p>
          ) : (
            coverSrc && (
              <p className="form-hint">
                <a href={coverSrc}>See the cover now</a>. Choose a photo to replace it.
              </p>
            )
          )}
        </div>

        <div className="form-check">
          <input
            id={ids.published}
            type="checkbox"
            name="published"
            value="yes"
            defaultChecked={values.published === "yes"}
            className="form-checkbox"
          />
          <label htmlFor={ids.published}>Published. Untick it to keep a draft only Hub staff can see.</label>
        </div>

        <div className="staff-actions">
          <button type="submit" name="intent" value="save" className="btn btn-primary">
            Save the post
          </button>
          <button type="submit" name="intent" value="preview" className="btn btn-outline text-navy">
            Preview
          </button>
        </div>
      </form>
    </>
  );
}
