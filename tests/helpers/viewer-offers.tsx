import { PublicOffers } from "@/components/looking-for/OffersViews";
import type { LookingForRequest } from "@/lib/types";

/**
 * Stands in for components/looking-for/ViewerOffers.tsx in component tests (community actions plan, Task 15). The real
 * one is an async Server Component, which jsdom can't render inside a tree; this renders the signed-out panel. It
 * imports OffersViews, not OffersPanel: OffersPanel imports the mocked ViewerOffers, which would wait on this very
 * factory and never finish. In a test file:
 *
 *   vi.mock("@/components/looking-for/ViewerOffers", async () => (await import("@/tests/helpers/viewer-offers")).signedOutViewerOffers);
 */
export const signedOutViewerOffers = {
  ViewerOffers: ({ request }: { request: LookingForRequest }) => (
    <PublicOffers request={request} signedIn={false} open={request.status === "open"} />
  ),
};
