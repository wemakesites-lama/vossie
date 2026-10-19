import { FollowSignedOut } from "@/components/seller/FollowViews";

/**
 * Stands in for components/seller/ViewerFollow.tsx in component tests (community actions plan, Task 17): the real one
 * is an async Server Component, which jsdom can't render inside a tree. It imports FollowViews, not FollowControl:
 * FollowControl imports the mocked ViewerFollow, which would wait on this very factory and never finish. In a test file:
 *
 *   vi.mock("@/components/seller/ViewerFollow", async () => (await import("@/tests/helpers/viewer-follow")).signedOutViewerFollow);
 */
export const signedOutViewerFollow = {
  ViewerFollow: ({ slug, name }: { slug: string; name: string }) => <FollowSignedOut slug={slug} name={name} />,
};
