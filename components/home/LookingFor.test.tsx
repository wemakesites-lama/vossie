import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LookingFor } from "./LookingFor";

const viewer = vi.hoisted(() => ({ signedIn: false }));

// Post a request's session part is an async Server Component; here it follows `viewer.signedIn` (plan, Task 16).
vi.mock("@/components/looking-for/ViewerPostRequestLink", async () =>
  (await import("@/tests/helpers/viewer-post-request")).viewerPostRequestLink(() => viewer.signedIn),
);

// The requests read the cookie on the server; LookingForRequests.test.tsx covers them.
vi.mock("./LookingForRequests", () => ({
  LookingForRequests: () => <ul aria-label="Open requests" />,
  RequestsSkeleton: () => null,
}));

afterEach(() => {
  viewer.signedIn = false;
});

describe("LookingFor (spec 7.11)", () => {
  it("asks for requests, with a navy eyebrow on the sky band", () => {
    render(<LookingFor />);
    expect(screen.getByRole("region", { name: "Can’t find it? Ask for it." })).toBeInTheDocument();
    expect(screen.getByText("Looking For")).toHaveClass("text-navy");
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
