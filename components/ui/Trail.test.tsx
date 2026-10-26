import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Trail } from "./Trail";

vi.mock("next/link", async () => (await import("@/tests/helpers/next-link")).nextLinkShowingPrefetch);
vi.mock("@/components/ui/NavPending", () => ({ NavPending: () => null }));

const CRUMBS = [
  { label: "Home", href: "/" },
  { label: "Hub console", href: "/admin" },
  { label: "Reports", href: "/admin/reports" },
  { label: "Report on Tech corner", href: null },
];

describe("Trail (wayfinding spec 3.1)", () => {
  it("is one named list, the page last, current and unlinked", () => {
    render(<Trail crumbs={CRUMBS} />);
    const nav = screen.getByRole("navigation", { name: "Breadcrumb" });
    const items = within(nav).getAllByRole("listitem");
    expect(items).toHaveLength(4);
    expect(within(items[3]).queryByRole("link")).toBeNull();
    expect(within(items[3]).getByText("Report on Tech corner")).toHaveAttribute("aria-current", "page");
  });

  it("marks the parent as the back link, named for where it goes", () => {
    render(<Trail crumbs={CRUMBS} />);
    const back = screen.getByRole("link", { name: "Back to Reports" });
    expect(back).toHaveAttribute("href", "/admin/reports");
    expect(back.closest("li")).toHaveClass("trail-parent");
    expect(screen.getByRole("link", { name: "Hub console" }).closest("li")).not.toHaveClass("trail-parent");
  });

  it("never prefetches", () => {
    render(<Trail crumbs={CRUMBS} />);
    for (const link of screen.getAllByRole("link")) expect(link).toHaveAttribute("data-prefetch", "false");
  });

  it("renders nothing for a top-level page", () => {
    const { container } = render(<Trail crumbs={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
