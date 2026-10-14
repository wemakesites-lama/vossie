import Link from "next/link";
import { ErrorSummary } from "@/components/forms/ErrorSummary";
import { FieldError } from "@/components/forms/FieldError";
import { errorFor, type FormError } from "@/lib/auth/messages";
import type { OnboardingDraftRow } from "@/lib/data/rows";
import { shopFieldIds } from "@/lib/selling/errors";
import { ONBOARDING_STEPS, onboardingPath, type OnboardingStep } from "@/lib/selling/paths";
import { saveOnboardingStep, sendForApproval } from "@/lib/selling/shop-actions";
import type { Campus, Category, PickupPoint } from "@/lib/types";
import { AboutField, CampusSpotsFields, NameFields, ShopPhotoField } from "./ShopFields";

type OnboardingViewProps = {
  step: OnboardingStep;
  draft: OnboardingDraftRow;
  errors: readonly FormError[];
  campuses: readonly Pick<Campus, "slug" | "name">[];
  categories: readonly Pick<Category, "slug" | "name">[];
  pickupPoints: readonly PickupPoint[];
};

const IDS = shopFieldIds("onb");

/** A step's Back link: it replaces the history entry, so the wizard is one entry in the history (plan decision 15). */
function BackLink({ step }: { step: OnboardingStep }) {
  if (step === 1) return null;
  return (
    <Link href={onboardingPath((step - 1) as OnboardingStep)} replace prefetch={false} className="link-button">
      Back
    </Link>
  );
}

/**
 * One step of the wizard (selling spec 2.6): its progress in words, its errors, and a plain form posting to
 * saveOnboardingStep, or the review and Send for approval. Each step's form and summary have their own keys and ids,
 * because Next keeps `?step=1` and `?step=2` as one page, and kept copies must not share an id or carry what was typed
 * into the next (plan amendments 1 and 2).
 */
export function OnboardingView({ step, draft, errors, campuses, categories, pickupPoints }: OnboardingViewProps) {
  return (
    <div className="sell-section">
      <p className="sell-progress">
        Step {step} of 5: {ONBOARDING_STEPS[step - 1].name}
      </p>
      <ErrorSummary id={`onb-step-${step}-summary`} errors={errors} />
      {step === 5 ? (
        <Review draft={draft} errors={errors} campuses={campuses} categories={categories} pickupPoints={pickupPoints} />
      ) : (
        <form key={`step-${step}`} action={saveOnboardingStep} noValidate className="form-stack">
          <input type="hidden" name="step" value={step} />
          {step === 1 && (
            <NameFields
              ids={IDS}
              errors={errors}
              name={draft.name}
              tagline={draft.tagline}
              categorySlug={draft.categorySlug}
              categories={categories}
            />
          )}
          {step === 2 && <AboutField ids={IDS} errors={errors} about={draft.about} />}
          {step === 3 && (
            <ShopPhotoField
              ids={IDS}
              errors={errors}
              current={draft.photoSrc}
              categorySlug={draft.categorySlug}
              remove="button"
            />
          )}
          {step === 4 && (
            <CampusSpotsFields
              ids={IDS}
              errors={errors}
              campusSlug={draft.campusSlug}
              chosen={draft.pickupPointIds}
              campuses={campuses}
              pickupPoints={pickupPoints}
            />
          )}
          <div className="sell-form-buttons">
            <button type="submit" className="btn btn-primary form-submit">
              Continue
            </button>
            <BackLink step={step} />
          </div>
        </form>
      )}
    </div>
  );
}

/** Step 5 (selling spec 2.6): every answer with a way to change it, the guidelines box, and Send for approval. */
function Review({
  draft,
  errors,
  campuses,
  categories,
  pickupPoints,
}: Omit<OnboardingViewProps, "step">) {
  const campus = campuses.find((item) => item.slug === draft.campusSlug);
  const spots = pickupPoints.filter((point) => point.campusSlug === draft.campusSlug);
  const chosen = spots.filter((point) => draft.pickupPointIds.includes(point.id)).map((point) => point.name);
  let spotsLine = chosen.join(", ") || "Not answered";
  if (spots.length === 0) spotsLine = "None: you'll meet buyers online";
  const rows: ReadonlyArray<[label: string, value: string, step: OnboardingStep]> = [
    ["Shop name", draft.name || "Not answered", 1],
    ["Tagline", draft.tagline || "None", 1],
    ["Main category", categories.find((item) => item.slug === draft.categorySlug)?.name ?? "Not answered", 1],
    ["About", draft.about || "Not answered", 2],
    ["Photo", draft.photoSrc ? "Your photo" : "Your category's picture", 3],
    ["Campus", campus?.name ?? "Not answered", 4],
    ["Pickup points", spotsLine, 4],
  ];
  const guidelinesError = errorFor(errors, IDS.guidelines);
  return (
    <>
      <section aria-labelledby="onb-review-title" className="sell-section">
        <h2 id="onb-review-title" className="sell-section-title">
          Your answers
        </h2>
        <dl className="sell-review">
          {rows.map(([label, value, step]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
              <dd>
                <Link href={onboardingPath(step)} replace prefetch={false}>
                  Change <span className="sr-only">{label.toLowerCase()}</span>
                </Link>
              </dd>
            </div>
          ))}
        </dl>
      </section>
      <form key="step-5" action={sendForApproval} noValidate className="form-stack">
        <div className="form-field">
          <FieldError id={`${IDS.guidelines}-error`} message={guidelinesError} />
          <div className="form-check">
            <input
              id={IDS.guidelines}
              name="guidelines"
              type="checkbox"
              value="yes"
              required
              aria-invalid={guidelinesError ? true : undefined}
              aria-describedby={guidelinesError ? `${IDS.guidelines}-error` : undefined}
              className="form-checkbox"
            />
            <label htmlFor={IDS.guidelines}>
              I&apos;ve read the{" "}
              <Link href="/seller-guidelines" prefetch={false}>
                seller guidelines
              </Link>
            </label>
          </div>
        </div>
        <div className="sell-form-buttons">
          <button type="submit" className="btn btn-primary form-submit">
            Send for approval
          </button>
          <BackLink step={5} />
        </div>
      </form>
    </>
  );
}
