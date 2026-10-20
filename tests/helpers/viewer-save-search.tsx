import { SaveSearchSignedOut } from "@/components/browse/SaveSearchViews";
import type { MatchQuery } from "@/lib/types";

/**
 * Stands in for components/browse/ViewerSaveSearch.tsx in component tests (search alerts plan, Task 4): the real one
 * is an async Server Component, which jsdom can't render inside a tree. It imports SaveSearchViews, not
 * SaveSearchControl: SaveSearchControl imports the mocked ViewerSaveSearch, which would wait on this very factory and
 * never finish (plan amendment 2). In a test file:
 *
 *   vi.mock("@/components/browse/ViewerSaveSearch", async () =>
 *     (await import("@/tests/helpers/viewer-save-search")).signedOutViewerSaveSearch,
 *   );
 */
export const signedOutViewerSaveSearch = {
  ViewerSaveSearch: ({ from }: { search: MatchQuery; from: string }) => <SaveSearchSignedOut from={from} />,
};
