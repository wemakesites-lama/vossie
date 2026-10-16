import { connection } from "next/server";
import { readFormState } from "@/lib/auth/form-state";
import { getViewer } from "@/lib/auth/session";
import { getPickupPoints } from "@/lib/data";
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

/**
 * Where a half-done application picks up: the first step not yet answered. Step 3's photo is optional, so a draft
 * with a photo has passed it; step 4 needs one of the campus's points in use (`spots`), only on a campus that has some
 * (Eduvos Online has none). A saved point the Hub has retired since doesn't count (staff tools spec 2.3).
 */
function resumeStep(draft: OnboardingDraftRow, spots: readonly string[]): OnboardingStep {
  if (!draft.name || !draft.categorySlug) return 1;
  if (!draft.about) return 2;
  const pointsMissing = spots.length > 0 && !draft.pickupPointIds.some((id) => spots.includes(id));
  if (!draft.campusSlug || pointsMissing) return draft.photoSrc ? 4 : 3;
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
    const [draft, pickupPoints] = await Promise.all([getOnboardingDraft(account.id), getPickupPoints()]);
    const spots = pickupPoints.filter((point) => point.campusSlug === draft?.campusSlug).map((point) => point.id);
    const step = draft ? resumeStep(draft, spots) : 1;
    return <SellPitch startHref={onboardingPath(step)} resuming={draft !== null} />;
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
