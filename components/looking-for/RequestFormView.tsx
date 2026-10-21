import Link from "next/link";
import { CampusSelect } from "@/components/forms/CampusSelect";
import { ErrorSummary } from "@/components/forms/ErrorSummary";
import { describedBy, FieldError } from "@/components/forms/FieldError";
import { ArrowLeftIcon } from "@/components/icons";
import { errorFor, type FormError } from "@/lib/auth/messages";
import type { FormStateRow } from "@/lib/data/rows";
import { reopenMyRequest, saveMyRequest } from "@/lib/looking-for/actions";
import { requestErrors, requestFieldIds } from "@/lib/looking-for/errors";
import { requestFieldPrefix, requestPath, YOUR_REQUESTS_PATH } from "@/lib/looking-for/paths";
import { addDays, DETAILS_MAX, DETAILS_MIN, NEEDED_BY_DAYS, TITLE_MAX, TITLE_MIN } from "@/lib/looking-for/rules";
import { CLOSES_BY_ITSELF_HINT, REOPEN_CLEARS_DATE_HINT } from "@/lib/looking-for/words";
import type { Campus, Category, LookingForRequest } from "@/lib/types";

/** What the request form shows in its fields (community actions spec 2.3). */
export type RequestFormValues = {
  title: string;
  category: string;
  campus: string;
  details: string;
  budget: string;
  swap: boolean;
  neededBy: string;
};

export type RequestFormState = { values: RequestFormValues; errors: FormError[] };

/** A new request starts on the account's campus (spec 2.3); an edit starts from the request. */
export function startValues(request: LookingForRequest | null, campusSlug: string): RequestFormValues {
  if (!request) return { title: "", category: "", campus: campusSlug, details: "", budget: "", swap: false, neededBy: "" };
  return {
    title: request.title,
    category: request.categorySlug,
    campus: request.campusSlug,
    details: request.details,
    budget: request.budgetZar === null ? "" : String(request.budgetZar),
    swap: request.swapWelcome,
    neededBy: request.neededBy ?? "",
  };
}

/** After a failed post, what was typed and what's wrong (D decision 3); otherwise `start`. */
export function requestForm(state: FormStateRow | null, start: RequestFormValues, prefix: string): RequestFormState {
  if (!state || state.errors.length === 0) return { values: start, errors: [] };
  const typed = state.values;
  return {
    values: {
      title: typed.title ?? "",
      category: typed.category ?? "",
      campus: typed.campus ?? "",
      details: typed.details ?? "",
      budget: typed.budget ?? "",
      swap: typed.swap === "yes",
      neededBy: typed.neededBy ?? "",
    },
    errors: requestErrors(state.errors, requestFieldIds(prefix)),
  };
}

type RequestFormViewProps = {
  /** The request being edited, or null for a new one. */
  requestId: string | null;
  /**
   * A new request's one-time token, which makes it once however many times the form is sent (plan amendment 3). An edit
   * needs none; null too when nobody is signed in.
   */
  once: string | null;
  form: RequestFormState;
  campuses: readonly Pick<Campus, "slug" | "name">[];
  categories: readonly Pick<Category, "slug" | "name">[];
  /** Today in SAST (read after `await connection()`), for the date's first and last days (spec 2.3). */
  today: string;
};

/**
 * The request form (community actions spec 2.3 and section 4): every field labelled, its limits as text, each error
 * linked to its field. A plain form posting to saveMyRequest, so it works before the app's JavaScript arrives. Its
 * ids start with "request-new" or "request-<id>", so a kept page never repeats one (plan decision 2).
 */
export function RequestFormView({ requestId, once, form, campuses, categories, today }: RequestFormViewProps) {
  const prefix = requestFieldPrefix(requestId);
  const ids = requestFieldIds(prefix);
  const { values, errors } = form;
  const hint = (fieldId: string) => `${fieldId}-hint`;
  const errorId = (fieldId: string) => `${fieldId}-error`;
  const problem = (fieldId: string) => errorFor(errors, fieldId);
  const describe = (fieldId: string, withHint = true) =>
    describedBy(withHint && hint(fieldId), problem(fieldId) && errorId(fieldId));
  const invalid = (fieldId: string) => (problem(fieldId) ? true : undefined);
  const back = requestId
    ? { href: requestPath(requestId), label: "Back to the request" }
    : { href: "/looking-for", label: "Back to Looking For" };
  return (
    <div className="request-form-column">
      <Link href={back.href} prefetch={false} className="msg-crumb">
        <ArrowLeftIcon />
        {back.label}
      </Link>
      <h1 className="request-form-title">{requestId ? "Edit your request" : "Ask for what you need"}</h1>
      {!requestId && (
        <p className="request-form-lede">
          Shops on CampusCart see it and offer to help. It never shows your name, only &quot;Asked by a student at&quot; your
          campus.
        </p>
      )}
      <ErrorSummary id={`${prefix}-summary`} errors={errors} />
      <form action={saveMyRequest} noValidate className="form-stack">
        {requestId && <input type="hidden" name="request" value={requestId} />}
        {!requestId && once && <input type="hidden" name="once" value={once} />}
        <div className="form-field">
          <label htmlFor={ids.title} className="form-label">
            What you need
          </label>
          <p id={hint(ids.title)} className="form-hint">
            {`Between ${TITLE_MIN} and ${TITLE_MAX} characters, like "Accounting 1 tutor this week".`}
          </p>
          <FieldError id={errorId(ids.title)} message={problem(ids.title)} />
          <input
            id={ids.title}
            name="title"
            type="text"
            required
            defaultValue={values.title}
            aria-invalid={invalid(ids.title)}
            aria-describedby={describe(ids.title)}
            className="form-input"
          />
        </div>
        <div className="form-field">
          <label htmlFor={ids.category} className="form-label">
            Category
          </label>
          <FieldError id={errorId(ids.category)} message={problem(ids.category)} />
          <select
            id={ids.category}
            name="category"
            required
            defaultValue={values.category}
            aria-invalid={invalid(ids.category)}
            aria-describedby={describe(ids.category, false)}
            className="form-input form-select"
          >
            <option value="">Choose a category</option>
            {categories.map((category) => (
              <option key={category.slug} value={category.slug}>
                {category.name}
              </option>
            ))}
          </select>
        </div>
        <div className="form-field">
          <label htmlFor={ids.campus} className="form-label">
            Campus
          </label>
          <p id={hint(ids.campus)} className="form-hint">
            Shops see requests from their own campus first.
          </p>
          <FieldError id={errorId(ids.campus)} message={problem(ids.campus)} />
          <CampusSelect
            id={ids.campus}
            defaultValue={values.campus}
            campuses={campuses}
            invalid={Boolean(problem(ids.campus))}
            describedBy={describe(ids.campus)}
          />
        </div>
        <div className="form-field">
          <label htmlFor={ids.details} className="form-label">
            Details
          </label>
          <p id={hint(ids.details)} className="form-hint">
            {`Say what you need and when. Shops will message you on CampusCart. Between ${DETAILS_MIN} and ${DETAILS_MAX} characters.`}
          </p>
          <FieldError id={errorId(ids.details)} message={problem(ids.details)} />
          <textarea
            id={ids.details}
            name="details"
            rows={6}
            required
            defaultValue={values.details}
            aria-invalid={invalid(ids.details)}
            aria-describedby={describe(ids.details)}
            className="form-input request-form-textarea"
          />
        </div>
        <div className="form-field">
          <label htmlFor={ids.budget} className="form-label">
            Budget in rand (optional)
          </label>
          <p id={hint(ids.budget)} className="form-hint">
            Whole rand, like 300. Leave it empty for Open to offers.
          </p>
          <FieldError id={errorId(ids.budget)} message={problem(ids.budget)} />
          <input
            id={ids.budget}
            name="budget"
            type="text"
            inputMode="numeric"
            defaultValue={values.budget}
            aria-invalid={invalid(ids.budget)}
            aria-describedby={describe(ids.budget)}
            className="form-input request-form-short"
          />
        </div>
        <div className="form-check">
          <input
            id={ids.swap}
            name="swap"
            type="checkbox"
            value="yes"
            defaultChecked={values.swap}
            className="form-checkbox"
          />
          <label htmlFor={ids.swap}>A swap is welcome</label>
        </div>
        <div className="form-field">
          <label htmlFor={ids.neededBy} className="form-label">
            Needed by (optional)
          </label>
          <p id={hint(ids.neededBy)} className="form-hint">
            {`Today or within ${NEEDED_BY_DAYS} days, as year, month and day, like ${addDays(today, 7)}. ${CLOSES_BY_ITSELF_HINT}`}
          </p>
          <FieldError id={errorId(ids.neededBy)} message={problem(ids.neededBy)} />
          <input
            id={ids.neededBy}
            name="neededBy"
            type="date"
            min={today}
            max={addDays(today, NEEDED_BY_DAYS)}
            defaultValue={values.neededBy}
            aria-invalid={invalid(ids.neededBy)}
            aria-describedby={describe(ids.neededBy)}
            className="form-input request-form-short"
          />
        </div>
        <button type="submit" className="btn btn-primary form-submit">
          {requestId ? "Save changes" : "Post request"}
        </button>
      </form>
    </div>
  );
}

type RequestLockedProps = {
  requestId: string;
  title: string;
  state: "closed" | "hidden";
  /** Reopening takes off a needed-by date that has passed: a hint says so, tied to Reopen (plan decision 18). */
  reopenClearsDate?: boolean;
};

/** A closed or hidden request's edit page: why it can't be changed, and what can be done (plan decision 6). */
export function RequestLocked({ requestId, title, state, reopenClearsDate = false }: RequestLockedProps) {
  const back =
    state === "closed"
      ? { href: requestPath(requestId), label: "Back to the request" }
      : { href: YOUR_REQUESTS_PATH, label: "Back to Your requests" };
  const hintId = reopenClearsDate ? `reopen-hint-locked-${requestId}` : undefined;
  return (
    <div className="request-form-column">
      <Link href={back.href} prefetch={false} className="msg-crumb">
        <ArrowLeftIcon />
        {back.label}
      </Link>
      <h1 className="request-form-title">Edit your request</h1>
      {state === "closed" ? (
        <div className="request-form-note">
          <p className="form-notice">This request is closed. Reopen it to change it.</p>
          <form action={reopenMyRequest}>
            <input type="hidden" name="request" value={requestId} />
            <button type="submit" className="btn btn-outline text-navy" aria-describedby={hintId}>
              Reopen <span className="sr-only">{title}</span>
            </button>
          </form>
          {hintId && (
            <p id={hintId} className="form-hint">
              {REOPEN_CLEARS_DATE_HINT}
            </p>
          )}
        </div>
      ) : (
        <p className="form-notice">
          The Hub hid this request, so it can&apos;t be changed. You can still delete it from{" "}
          <Link href={YOUR_REQUESTS_PATH} prefetch={false}>
            Your requests
          </Link>
          .
        </p>
      )}
    </div>
  );
}
