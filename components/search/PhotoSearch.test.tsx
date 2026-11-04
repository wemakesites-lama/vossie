import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PhotoSearch, PhotoSearchSkeleton } from "./PhotoSearch";

const viewer = vi.hoisted(() => ({
  account: null as null | { id: string },
  notice: null as string | null,
}));

vi.mock("next/link", async () => (await import("@/tests/helpers/next-link")).nextLinkShowingPrefetch);
vi.mock("@/lib/auth/session", () => ({ getViewer: async () => viewer.account }));
vi.mock("@/lib/selling/form-state", () => ({
  takeNotice: async () => (viewer.notice ? { errors: [], values: {}, notice: viewer.notice } : null),
}));
vi.mock("@/lib/search/photo-actions", () => ({ searchByPhoto: async () => {} }));

afterEach(() => {
  viewer.account = null;
  viewer.notice = null;
});

describe("Snap to search's form (AI features spec section 5)", () => {
  it("signed out, offers sign-in that comes back here, never prefetched (spec 5.4)", async () => {
    render(await PhotoSearch());
    const link = screen.getByRole("link", { name: "Sign in" });
    expect(link).toHaveAttribute("href", "/login?next=%2Fbrowse%2Fphoto");
    expect(link.dataset.prefetch).toBe("false");
    expect(screen.queryByLabelText("Photo")).not.toBeInTheDocument();
  });

  it("signed in, shows the labelled photo field, an empty notice region and the Search button (spec 5.6)", async () => {
    viewer.account = { id: "acc-student" };
    render(await PhotoSearch());
    const input = screen.getByLabelText("Photo");
    expect(input).toHaveAttribute("type", "file");
    expect(input).toHaveAttribute("name", "photo");
    expect(input).toBeRequired();
    expect(input).toHaveAttribute("aria-describedby", "photo-search-hint photo-search-notice");
    expect(input.getAttribute("accept")).toContain("image/heic");
    expect(document.getElementById("photo-search-notice")).toBeEmptyDOMElement();
    expect(screen.getByRole("button", { name: "Search" })).toHaveAttribute("type", "submit");
  });

  it("says why it couldn't tell in the notice region (spec 5.2)", async () => {
    viewer.account = { id: "acc-student" };
    viewer.notice = "cant-tell";
    render(await PhotoSearch());
    expect(document.getElementById("photo-search-notice")).toHaveTextContent(
      "Couldn't tell what that is. Try a closer photo, or type it.",
    );
  });

  it("shows nothing for a notice it doesn't know", async () => {
    viewer.account = { id: "acc-student" };
    viewer.notice = "something-else";
    render(await PhotoSearch());
    expect(document.getElementById("photo-search-notice")).toBeEmptyDOMElement();
  });

  it("has a wordless skeleton", () => {
    const { container } = render(<PhotoSearchSkeleton />);
    expect(container.firstElementChild).toHaveAttribute("aria-hidden", "true");
    expect(container).toHaveTextContent("");
  });
});
