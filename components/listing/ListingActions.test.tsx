import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { makeListing } from "@/tests/helpers/fakes";
import { ListingActions } from "./ListingActions";

// The session's links are async Server Components; here they're the signed-out links (messaging plan, Task 7).
vi.mock("@/components/messages/ViewerLinks", async () => (await import("@/tests/helpers/viewer-links")).signedOutViewerLinks);

describe("ListingActions (spec 5.4, 5.5)", () => {
  it("messages the seller through sign-in and on to the composer, and saves and shares (messaging spec 2.1)", () => {
    render(<ListingActions listing={makeListing({ id: "l-001", title: "Casio calculator" })} />);
    expect(screen.getByRole("link", { name: "Message seller" })).toHaveAttribute(
      "href",
      "/login?next=%2Flistings%2Fl-001%2Fmessage",
    );
    expect(screen.getByRole("button", { name: "Save Casio calculator" })).toHaveClass("save-heart-inline");
    expect(screen.getByRole("button", { name: "Share" })).toBeInTheDocument();
  });

  it("offers similar items instead when the listing is sold or paused", () => {
    render(<ListingActions listing={makeListing({ availability: "sold", categorySlug: "tech" })} />);
    expect(screen.queryByRole("link", { name: "Message seller" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "See similar items" })).toHaveAttribute("href", "/browse?cat=tech");
  });
});
