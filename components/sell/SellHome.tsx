import { connection } from "next/server";
import { readFormState } from "@/lib/auth/form-state";
import { getViewer } from "@/lib/auth/session";
import type { OnboardingDraftRow } from "@/lib/data/rows";
import { shopStats } from "@/lib/data/shop-stats";
import { getOnboardingDraft, getShopOf } from "@/lib/data/shops";
import { signInHref } from "@/lib/next-path";
import { badgeProgress } from "@/lib/selling/badges";
import { DASHBOARD_FORM } from "@/lib/selling/form-state";
import { noticeText } from "@/lib/selling/notices";
import { onboardingPath, type OnboardingStep } from "@/lib/selling/paths";
import { Dashboard } from "./Dashboard";
import { SellPitch } from "./SellPitch";
import { ShopWaiting } from "./ShopWaiting";

/** Where a half-done application picks up: the first step not yet answered (step 3's photo is optional). */
function resumeStep(draft: OnboardingDraftRow): OnboardingStep {
  if (!draft.name || !draft.categorySlug) return 1;
  if (!draft.about) return 2;
  if (draft.pickupPointIds.length === 0) return 3;
  return 5;
}

/**
 * Which /sell this visitor sees (selling spec section 3): the pitch without a shop, the waiting page while the Hub
 * checks one (spec 2.7), the dashboard once it's approved or paused (spec 2.8). Request-time: it reads the session.
 */
export async function SellHome() {
  const account = await getViewer().catch(() => null);
  if (!account) return <SellPitch startHref={signInHref(onboardingPath(1))} resuming={false} />;
  const own = await getShopOf(account.id);
  if (!own) {
    const draft = await getOnboardingDraft(account.id);
    return <SellPitch startHref={onboardingPath(draft ? resumeStep(draft) : 1)} resuming={draft !== null} />;
  }
  if (own.status === "pending") return <ShopWaiting shopName={own.shop.name} sentAt={own.shop.createdAt} />;
  // The week's numbers read the clock (decision 26).
  await connection();
  const now = new Date();
  const [stats, state] = await Promise.all([shopStats(own.shop.slug, now), readFormState(DASHBOARD_FORM)]);
  return (
    <Dashboard
      shop={{ name: own.shop.name, slug: own.shop.slug, badge: own.shop.badge }}
      paused={own.status === "paused"}
      stats={stats}
      badgeLine={badgeProgress(own.shop.badge, stats.record, account.createdAt, now)}
      notice={noticeText(state?.notice)}
    />
  );
}
