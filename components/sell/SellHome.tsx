import { connection } from "next/server";
import { getViewer } from "@/lib/auth/session";
import { getPickupPoints } from "@/lib/data";
import type { OnboardingDraftRow } from "@/lib/data/rows";
import { shopStats } from "@/lib/data/shop-stats";
import { getOnboardingDraft, getShopOf } from "@/lib/data/shops";
import { shopStanding } from "@/lib/data/staff-shops";
import { signInHref } from "@/lib/next-path";
import { badgeProgress } from "@/lib/selling/badges";
import { DASHBOARD_FORM, takeNotice } from "@/lib/selling/form-state";
import { noticeText } from "@/lib/selling/notices";
import { onboardingPath, type OnboardingStep } from "@/lib/selling/paths";
import type { PickupPoint } from "@/lib/types";
import { Dashboard } from "./Dashboard";
import { SellPitch } from "./SellPitch";
import { ShopDeclined } from "./ShopDeclined";
import { ShopWaiting } from "./ShopWaiting";

/**
 * Where a half-done application picks up: the first step not yet answered (step 3's photo is optional). Step 3 is
 * where it picks up only when the draft's campus has pickup points to choose; Eduvos Online has none, so everything
 * is answered and the student resumes at the review (amendment 10.4).
 */
function resumeStep(draft: OnboardingDraftRow, pickupPoints: readonly PickupPoint[]): OnboardingStep {
  if (!draft.name || !draft.categorySlug) return 1;
  if (!draft.about) return 2;
  const hasPoints = pickupPoints.some((point) => point.campusSlug === draft.campusSlug);
  if (hasPoints && draft.pickupPointIds.length === 0) return 3;
  return 5;
}

/**
 * Which /sell this visitor sees (selling spec section 3): the pitch without a shop, the waiting page while the Hub
 * checks one (spec 2.7), or the Hub's reason once it has declined it (staff tools plan decision 2), the dashboard once
 * it's approved or paused (spec 2.8). Request-time: it reads the session.
 */
export async function SellHome() {
  const account = await getViewer().catch(() => null);
  if (!account) return <SellPitch startHref={signInHref(onboardingPath(1))} resuming={false} />;
  const own = await getShopOf(account.id);
  if (!own) {
    const draft = await getOnboardingDraft(account.id);
    const step = draft ? resumeStep(draft, await getPickupPoints()) : 1;
    return <SellPitch startHref={onboardingPath(step)} resuming={draft !== null} />;
  }
  const standing = await shopStanding(account.id);
  if (own.status === "pending") {
    // A declined shop is a waiting one with the Hub's reason (staff tools plan decision 2).
    if (standing?.declinedAt) {
      return <ShopDeclined shopName={own.shop.name} declinedAt={standing.declinedAt} reason={standing.reason ?? ""} />;
    }
    // Sent again after a decline, it shows the date it was sent again (amendment 6).
    return <ShopWaiting shopName={own.shop.name} sentAt={standing?.appliedAt ?? own.shop.createdAt} />;
  }
  // The week's numbers read the clock (decision 26).
  await connection();
  const now = new Date();
  // The notice is taken as it is shown, so a second visit says nothing (amendment 10.6).
  const [stats, state] = await Promise.all([shopStats(own.shop.slug, now), takeNotice(DASHBOARD_FORM)]);
  return (
    <Dashboard
      shop={{ name: own.shop.name, slug: own.shop.slug, badge: own.shop.badge }}
      paused={own.status === "paused"}
      stats={stats}
      badgeLine={badgeProgress(own.shop.badge, stats.record, account.createdAt, now)}
      notice={noticeText(state?.notice)}
      hubPause={standing?.pausedByHub ? (standing.reason ?? "") : null}
    />
  );
}
