import { connection } from "next/server";
import { getViewer } from "@/lib/auth/session";
import { getPickupPoints } from "@/lib/data";
import { followerCounts } from "@/lib/data/follows";
import type { OnboardingDraftRow } from "@/lib/data/rows";
import { dailyEnquiries, recentCounts, shopStats } from "@/lib/data/shop-stats";
import { getOnboardingDraft, getShopOf } from "@/lib/data/shops";
import { shopStanding } from "@/lib/data/staff-shops";
import { DAY_MS } from "@/lib/messaging/rules";
import { signInHref } from "@/lib/next-path";
import { badgeProgress } from "@/lib/selling/badges";
import { DASHBOARD_FORM, takeNotice } from "@/lib/selling/form-state";
import { noticeText } from "@/lib/selling/notices";
import { onboardingPath, type OnboardingStep } from "@/lib/selling/paths";
import { queueFor } from "@/lib/selling/queue";
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
 * checks one (spec 2.7), or the Hub's reason once it has declined it (staff tools plan decision 2), the home once
 * it's approved or paused (role views spec 7.1). Request-time: it reads the session.
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
  // The ages, the weeks and the days read the clock (decision 26).
  await connection();
  const now = new Date();
  const slug = own.shop.slug;
  // Each card stands on its own reader: a failure is null, and only that card shows its error box (spec 8). The
  // notice is taken as it is shown, so a second visit says nothing (amendment 10.6).
  const [queue, stats, week, daily, followers, state, points] = await Promise.all([
    queueFor(slug).catch(() => null),
    shopStats(slug, now).catch(() => null),
    recentCounts(slug, 7, now).catch(() => null),
    dailyEnquiries(slug, 7, now).catch(() => null),
    followerCounts(slug, new Date(now.getTime() - 7 * DAY_MS)).catch(() => null),
    takeNotice(DASHBOARD_FORM),
    getPickupPoints().catch(() => [] as PickupPoint[]),
  ]);
  return (
    <Dashboard
      shop={own.shop}
      paused={own.status === "paused"}
      hubPause={standing?.pausedByHub ? (standing.reason ?? "") : null}
      notice={noticeText(state?.notice)}
      now={now}
      queue={queue}
      record={stats?.record ?? null}
      badgeLine={stats ? badgeProgress(own.shop.badge, stats.record, account.createdAt, now) : ""}
      week={week}
      daily={daily}
      followers={followers}
      campusHasPoints={points.some((point) => point.campusSlug === own.shop.campusSlug)}
    />
  );
}
