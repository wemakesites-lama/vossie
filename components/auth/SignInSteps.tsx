import Link from "next/link";
import { CampusSelect } from "@/components/forms/CampusSelect";
import { ErrorSummary } from "@/components/forms/ErrorSummary";
import { describedBy, FieldError } from "@/components/forms/FieldError";
import { cancelSignIn, completeProfile, resendCode, signInAsSample, startSignIn, verifyCode } from "@/lib/auth/actions";
import { errorFor, SIGN_IN_FIELDS, type FormError } from "@/lib/auth/messages";
import type { Campus } from "@/lib/types";

// The sign-in card's states (accounts spec 3.1). Server Components: every form posts to a Server Action, so each step
// works before the app's JavaScript arrives (plan decision 2).

const FIELDS = SIGN_IN_FIELDS;

export type SampleSignIn = { email: string; label: string };

/** Carries `next` through a step's post, so the last step can follow it. The server checks it again (spec 2.10). */
function NextField({ next }: { next: string | null }) {
  return next ? <input type="hidden" name="next" value={next} /> : null;
}

type EmailStepProps = {
  next: string | null;
  email: string;
  consented: boolean;
  errors: readonly FormError[];
  /** The sample accounts, in sample mode only (spec 2.8). */
  samples: readonly SampleSignIn[] | null;
};

/** Step 1: your Eduvos email and the privacy policy box; in sample mode, the sample accounts too. */
export function EmailStep({ next, email, consented, errors, samples }: EmailStepProps) {
  const emailError = errorFor(errors, FIELDS.email);
  const consentError = errorFor(errors, FIELDS.consent);
  return (
    <div className="signin-card">
      <ErrorSummary id="signin-email-summary" errors={errors} />
      <form action={startSignIn} noValidate className="form-stack">
        <NextField next={next} />
        <div className="form-field">
          <label htmlFor={FIELDS.email} className="form-label">
            Your Eduvos email address
          </label>
          <p id="signin-email-hint" className="form-hint">
            We&apos;ll send you a 6-digit code to sign in.
          </p>
          <FieldError id="signin-email-error" message={emailError} />
          <input
            id={FIELDS.email}
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            spellCheck={false}
            required
            maxLength={254}
            defaultValue={email}
            aria-invalid={emailError ? true : undefined}
            aria-describedby={describedBy("signin-email-hint", emailError && "signin-email-error")}
            className="form-input"
          />
        </div>
        <div className="form-field">
          <FieldError id="signin-consent-error" message={consentError} />
          <div className="form-check">
            <input
              id={FIELDS.consent}
              name="consent"
              type="checkbox"
              value="yes"
              required
              defaultChecked={consented}
              aria-invalid={consentError ? true : undefined}
              aria-describedby={describedBy(consentError && "signin-consent-error")}
              className="form-checkbox"
            />
            <label htmlFor={FIELDS.consent}>
              I agree to the <Link href="/privacy">privacy policy</Link>
            </label>
          </div>
        </div>
        <button type="submit" className="btn btn-primary form-submit">
          Send code
        </button>
      </form>
      {samples && <SampleAccounts next={next} samples={samples} />}
    </div>
  );
}

/** "Sign in as a sample account" (spec 2.8): one form, one button per account, each posting its email. */
function SampleAccounts({ next, samples }: { next: string | null; samples: readonly SampleSignIn[] }) {
  return (
    <section aria-labelledby="signin-samples-title" className="signin-samples">
      <p className="signin-or" aria-hidden="true">
        or
      </p>
      <h2 id="signin-samples-title" className="signin-samples-title">
        Sign in as a sample account
      </h2>
      <p className="form-hint">Sample mode only: straight in, no code.</p>
      <form action={signInAsSample} className="signin-sample-list">
        <NextField next={next} />
        {samples.map((sample) => (
          <button
            key={sample.email}
            type="submit"
            name="email"
            value={sample.email}
            className="btn btn-outline text-navy"
          >
            {sample.label}
          </button>
        ))}
      </form>
    </section>
  );
}

type CodeStepProps = {
  next: string | null;
  maskedEmail: string;
  errors: readonly FormError[];
  resent: boolean;
  /** The code itself, in sample mode only (spec 2.3). */
  sampleCode: string | null;
};

/** Step 2: the 6-digit code, with Send a new code and Use a different email. */
export function CodeStep({ next, maskedEmail, errors, resent, sampleCode }: CodeStepProps) {
  const codeError = errorFor(errors, FIELDS.code);
  return (
    <div className="signin-card">
      <ErrorSummary id="signin-code-summary" errors={errors} />
      {resent && (
        <p role="status" className="form-notice">
          We sent a new code.
        </p>
      )}
      <p id="signin-code-sent" className="signin-lede">
        We sent a code to <strong>{maskedEmail}</strong>. It lasts 10 minutes.
      </p>
      {sampleCode && (
        <p className="signin-sample-code">
          Sample mode: your code is <strong>{sampleCode}</strong>
        </p>
      )}
      <form action={verifyCode} noValidate className="form-stack">
        <NextField next={next} />
        <div className="form-field">
          <label htmlFor={FIELDS.code} className="form-label">
            6-digit code
          </label>
          <FieldError id="signin-code-error" message={codeError} />
          {/* Arriving at step 2 puts you in the field, with or without the app's JavaScript. After an error, the
              summary is focused instead (plan decision 11). */}
          <input
            id={FIELDS.code}
            name="code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            required
            autoFocus={errors.length === 0}
            aria-invalid={codeError ? true : undefined}
            aria-describedby={describedBy("signin-code-sent", codeError && "signin-code-error")}
            className="form-input form-input-code"
          />
        </div>
        <button type="submit" className="btn btn-primary form-submit">
          Sign in
        </button>
      </form>
      <div className="signin-secondary">
        <form action={resendCode}>
          <NextField next={next} />
          <button type="submit" className="link-button">
            Send a new code
          </button>
        </form>
        <form action={cancelSignIn}>
          <NextField next={next} />
          <button type="submit" className="link-button">
            Use a different email
          </button>
        </form>
      </div>
    </div>
  );
}

type ProfileStepProps = {
  next: string | null;
  firstName: string;
  /** The campus slug to start on, or "". */
  campus: string;
  campuses: readonly Pick<Campus, "slug" | "name">[];
  errors: readonly FormError[];
};

/** Step 3, a first sign-in only (spec 2.6): your first name and your campus. */
export function ProfileStep({ next, firstName, campus, campuses, errors }: ProfileStepProps) {
  const nameError = errorFor(errors, FIELDS.firstName);
  const campusError = errorFor(errors, FIELDS.campus);
  return (
    <div className="signin-card">
      <ErrorSummary id="signin-profile-summary" errors={errors} />
      <p className="signin-lede">First time on Vossie? Tell us two things and you&apos;re in.</p>
      <form action={completeProfile} noValidate className="form-stack">
        <NextField next={next} />
        <div className="form-field">
          <label htmlFor={FIELDS.firstName} className="form-label">
            Your first name
          </label>
          <p id="signin-first-name-hint" className="form-hint">
            Sellers see it when you message them. 2 to 40 characters.
          </p>
          <FieldError id="signin-first-name-error" message={nameError} />
          <input
            id={FIELDS.firstName}
            name="firstName"
            type="text"
            autoComplete="given-name"
            required
            maxLength={40}
            defaultValue={firstName}
            aria-invalid={nameError ? true : undefined}
            aria-describedby={describedBy("signin-first-name-hint", nameError && "signin-first-name-error")}
            className="form-input"
          />
        </div>
        <div className="form-field">
          <label htmlFor={FIELDS.campus} className="form-label">
            Your campus
          </label>
          <FieldError id="signin-campus-error" message={campusError} />
          <CampusSelect
            id={FIELDS.campus}
            defaultValue={campus}
            campuses={campuses}
            invalid={Boolean(campusError)}
            describedBy={describedBy(campusError && "signin-campus-error")}
          />
        </div>
        <button type="submit" className="btn btn-primary form-submit">
          Continue
        </button>
      </form>
    </div>
  );
}

/** Signed in already (spec 3.1, plan decision 10): who as, and the way to the account. The back link sits below. */
export function SignedInNote({ email }: { email: string }) {
  return (
    <div className="signin-card">
      <p className="signin-lede">
        You&apos;re signed in as <strong>{email}</strong>.
      </p>
      <Link href="/account" prefetch={false} className="btn btn-primary form-submit">
        Your account
      </Link>
    </div>
  );
}

/** Sample mode is off and there's no backend yet (spec 2.1, plan decision 17). */
export function SignInUnavailable() {
  return (
    <div className="signin-card">
      <p className="signin-lede">
        Sign-in isn&apos;t available yet. You can still browse every campus and save listings on this device.
      </p>
      <Link href="/browse" className="btn btn-primary form-submit">
        Browse
      </Link>
    </div>
  );
}
