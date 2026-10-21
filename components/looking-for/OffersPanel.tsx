import { Suspense } from "react";
import type { LookingForRequest } from "@/lib/types";
import { PublicOffers } from "./OffersViews";
import { ViewerOffers } from "./ViewerOffers";

/**
 * The request page's offers (community actions spec 2.13 and section 3): the session's part in its own <Suspense>,
 * with the signed-out public panel as the fallback, so the page keeps its prerendered shell. Server Components and
 * Links with no prefetch: no client bytes. The two versions are in OffersViews.tsx.
 */
export function OffersPanel({ request }: { request: LookingForRequest }) {
  return (
    <Suspense fallback={<PublicOffers request={request} signedIn={false} open={request.status === "open"} />}>
      <ViewerOffers request={request} />
    </Suspense>
  );
}
