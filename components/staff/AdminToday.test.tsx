import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { NeedsYouItem } from "@/components/kit/NeedsYouList";
import { AdminToday } from "./AdminToday";

const WAITING: NeedsYouItem[] = [
  { key: "shops", count: 2, title: "Shops to approve", detail: "Oldest: Crochet corner", age: { label: "11 days", tone: "warning" }, href: "/admin/sellers/crochet-corner", urgent: true },
];

const WEEK = {
  label: "12 to 18 Oct",
  beforeLabel: "5 to 11 Oct",
  tiles: [{ key: "reports-made" as const, label: "Reports made", value: "under5" as const, previous: 0 }],
  campuses: { rows: [], summary: "None at any campus last week.", tooSmall: true },
};

describe("Today (role views spec 7.2)", () => {
  it("opens the oldest item from its row, says All clear at zero, and never compares a masked count", () => {
    const { unmount } = render(<AdminToday waiting={WAITING} week={WEEK} badgesChanged={1} />);
    const list = screen.getByRole("list", { name: "Waiting" });
    expect(within(list).getByRole("link")).toHaveAttribute("href", "/admin/sellers/crochet-corner");
    const tiles = screen.getByRole("list", { name: "Last week's numbers" });
    expect(within(tiles).getByText("Under 5")).toBeInTheDocument();
    expect(within(tiles).getByText("Can't compare")).toBeInTheDocument();
    unmount();
    render(<AdminToday waiting={[]} week={null} badgesChanged={null} />);
    expect(screen.getByText("All clear: nothing is waiting for the Hub.")).toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: "Waiting" })).queryByRole("link")).toBeNull();
  });
});
