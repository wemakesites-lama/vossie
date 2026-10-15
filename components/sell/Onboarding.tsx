import { redirect } from "next/navigation";
import { connection } from "next/server";
import { readFormState } from "@/lib/auth/form-state";
import { requireAccount } from "@/lib/auth/session";
import { getCampuses, getCategories, getPickupPoints } from "@/lib/data";
import { emptyDraft, getOnboardingDraft } from "@/lib/data/shops";
import { sellingErrors, shopFieldIds } from "@/lib/selling/errors";
import { onboardingForm } from "@/lib/selling/form-state";
import { onboardingPath, parseStep, SELL_PATH } from "@/lib/selling/paths";
import { OnboardingView } from "./OnboardingView";

type OnboardingProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/**
 * The wizard's step for this account (selling spec 2.6 and section 3): request-time, as it reads the link, the
 * session and the draft. A visitor who has applied already goes to /sell.
 */
export async function Onboarding({ searchParams }: OnboardingProps) {
  const step = parseStep((await searchParams).step);
  const account = await requireAccount(onboardingPath(step));
  // The same test the wizard's actions use: anyone with a seller profile has applied already.
  if (account.seller) redirect(SELL_PATH);
  // A first visit makes an empty draft dated now (decision 26).
  await connection();
  const [draft, state, campuses, categories, pickupPoints] = await Promise.all([
    getOnboardingDraft(account.id),
    readFormState(onboardingForm(step)),
    getCampuses(),
    getCategories(),
    getPickupPoints(),
  ]);
  const shown = draft ?? emptyDraft(account.id, account.campusSlug, new Date());
  return (
    <OnboardingView
      step={step}
      draft={shown}
      errors={sellingErrors(state?.errors ?? [], shopFieldIds("onb"))}
      campuses={campuses}
      categories={categories}
      pickupPoints={pickupPoints}
    />
  );
}
