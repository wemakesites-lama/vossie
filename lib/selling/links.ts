import { getViewer } from "@/lib/auth/session";
import { getListingDetail } from "@/lib/data";
import type { MessageTarget } from "@/lib/messaging/paths";
import { editListingPath, PROFILE_PATH } from "./paths";

/**
 * The owner's link in Message seller's place (selling spec 2.12, plan decision 19): Edit listing on their own listing,
 * Edit shop on their own storefront. Null for everyone else. Request-time: it reads the session, so the component
 * that calls it sits inside <Suspense>.
 */
export async function ownerLinkFor(target: MessageTarget): Promise<{ href: string; label: string } | null> {
  const shopSlug = (await getViewer())?.seller?.sellerSlug ?? null;
  if (!shopSlug) return null;
  if (target.kind === "shop") return target.sellerSlug === shopSlug ? { href: PROFILE_PATH, label: "Edit shop" } : null;
  const detail = await getListingDetail(target.listingId);
  return detail?.listing.sellerSlug === shopSlug
    ? { href: editListingPath(target.listingId), label: "Edit listing" }
    : null;
}
