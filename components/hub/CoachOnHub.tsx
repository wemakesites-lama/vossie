import { connection } from "next/server";
import { CoachWeek } from "@/components/coach/CoachWeek";
import { aiFeatureOn } from "@/lib/ai/config";
import { getViewer } from "@/lib/auth/session";
import { readThisWeek } from "@/lib/coach/this-week";
import { getShopOf } from "@/lib/data/shops";

/**
 * The Launchpad's Coach card (AI round two spec 3): a signed-in seller's week above Coming up. Anyone else gets
 * nothing, so the page is unchanged. It renders inside the feed's Reveal, not a boundary of its own, so it arrives with
 * the feed and moves nothing (I1 planning decision 15). A failed read shows nothing.
 */
export async function CoachOnHub() {
  // Off: no session or shop read, so the feed's Reveal waits for nothing extra.
  if (!aiFeatureOn("shop-coach")) return null;
  const account = await getViewer().catch(() => null);
  if (!account) return null;
  await connection();
  const own = await getShopOf(account.id).catch(() => null);
  if (!own) return null;
  const view = await readThisWeek(account, own, new Date()).catch(() => null);
  if (!view) return null;
  // .hub-section gives it the feed's spacing and column, like Coming up.
  return (
    <div id="hub-coach" className="hub-section" data-tour="hub-coach">
      <CoachWeek view={view} from="hub" />
    </div>
  );
}
