import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LinkTabs } from "./LinkTabs";

const tabs = [
  { key: "all", label: "All", href: "/looking-for" },
  { key: "tech", label: "Tech", href: "/looking-for?cat=tech" },
];

describe("LinkTabs (community spec 4.1 and 5.1)", () => {
  it("lists the links in a named row, marking the current one", () => {
    render(<LinkTabs label="Categories" tabs={tabs} current="tech" look="chips" />);
    const nav = screen.getByRole("navigation", { name: "Categories" });
    expect(within(nav).getAllByRole("link").map((link) => link.getAttribute("href"))).toEqual([
      "/looking-for",
      "/looking-for?cat=tech",
    ]);
    expect(within(nav).getByRole("link", { name: "Tech" })).toHaveAttribute("aria-current", "page");
    expect(within(nav).getByRole("link", { name: "All" })).not.toHaveAttribute("aria-current");
  });

  it("looks like chips, or like browse's tabs (plan decision 7)", () => {
    const { unmount } = render(<LinkTabs label="Categories" tabs={tabs} current="all" look="chips" />);
    expect(screen.getByRole("navigation")).toHaveClass("link-chips");
    expect(screen.getByRole("link", { name: "All" })).toHaveClass("link-chip");
    unmount();
    render(<LinkTabs label="Post types" tabs={tabs} current="all" look="tabs" />);
    expect(screen.getByRole("navigation")).toHaveClass("category-tabs");
    expect(screen.getByRole("link", { name: "All" })).toHaveClass("category-tab");
  });
});
