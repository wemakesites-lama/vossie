import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LookingFor } from "./LookingFor";

const viewer = vi.hoisted(() => ({ signedIn: false }));

// Post a request's session part is an async Server Component; here it follows `viewer.signedIn` (plan, Task 16).
vi.mock("@/components/looking-for/ViewerPostRequestLink", async () =>
  (await import("@/tests/helpers/viewer-post-request")).viewerPostRequestLink(() => viewer.signedIn),
);

vi.mock("next/link", async () => (await import("@/tests/helpers/next-link")).nextLinkShowingPrefetch);

// The requests read the cookie on the server; LookingForRequests.test.tsx covers them.
vi.mock("./LookingForRequests", () => ({
  LookingForRequests: () => <ul aria-label="Open requests" />,
  RequestsSkeleton: () => null,
}));

afterEach(() => {
  viewer.signedIn = false;
  vi.unstubAllEnvs();
});

describe("LookingFor (spec 7.11)", () => {
  it("asks for requests, with a navy eyebrow on the sky band", () => {
    render(<LookingFor />);
    expect(screen.getByRole("region", { name: "Can’t find it? Ask for it." })).toBeInTheDocument();
    // on-sky, not navy: navy turns white in the dark themes, and white on sky fails.
    expect(screen.getByText("Looking For")).toHaveClass("text-on-sky");
    expect(screen.getByRole("list", { name: "Open requests" })).toBeInTheDocument();
    // Signed out: through sign-in, back to the form (community actions spec section 3).
    expect(screen.getByRole("link", { name: "Post a request" })).toHaveAttribute(
      "href",
      "/login?next=%2Flooking-for%2Fnew",
    );
  });

  it("opens the request form itself once the visitor is signed in", () => {
    viewer.signedIn = true;
    render(<LookingFor />);
    expect(screen.getByRole("link", { name: "Post a request" })).toHaveAttribute("href", "/looking-for/new");
  });
});

describe("LookingFor's starter pack link (AI round two spec section 6, stage H planning decision 12)", () => {
  it("offers a starter pack only while the feature is on, never prefetched", () => {
    vi.stubEnv("VOSSIE_AI_STARTER_PACK", "1");
    vi.stubEnv("VOSSIE_AI_PROVIDERS", "fake");
    const { unmount } = render(<LookingFor />);
    const link = screen.getByRole("link", { name: "New on campus? Get a starter pack" });
    expect(link).toHaveAttribute("href", "/browse/starter");
    expect(link.dataset.prefetch).toBe("false");
    unmount();
    vi.stubEnv("VOSSIE_AI_STARTER_PACK", "");
    render(<LookingFor />);
    expect(screen.queryByRole("link", { name: /starter pack/ })).not.toBeInTheDocument();
  });
});
