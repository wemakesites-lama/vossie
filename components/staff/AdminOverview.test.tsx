import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AdminOverview } from "./AdminOverview";

describe("Overview (staff tools spec 2.3)", () => {
  it("counts what needs attention, each with a link to it", () => {
    render(<AdminOverview waiting={2} openReports={1} openSlots={0} badgesChanged={1} />);
    const attention = screen.getByRole("region", { name: "Needs attention" });
    const items = within(attention).getAllByRole("listitem");
    expect(items.map((item) => item.textContent)).toEqual([
      "2Sellers waiting for approvalReview sellers",
      "1Open reportsReview reports",
      "0Slot requests waiting for an answerAnswer slot requests",
    ]);
    expect(within(items[0]).getByRole("link")).toHaveAttribute("href", "/admin/sellers");
    expect(within(items[1]).getByRole("link")).toHaveAttribute("href", "/admin/reports");
    expect(within(items[2]).getByRole("link")).toHaveAttribute("href", "/hub/manage#hub-queue");
  });

  it("says the badges were just worked out, and how many changed (spec 2.7, plan decision 8)", () => {
    const { rerender } = render(<AdminOverview waiting={0} openReports={0} openSlots={0} badgesChanged={1} />);
    expect(screen.getByRole("region", { name: "Trust badges" })).toHaveTextContent("1 shop's badge changed.");
    rerender(<AdminOverview waiting={0} openReports={0} openSlots={0} badgesChanged={0} />);
    expect(screen.getByRole("region", { name: "Trust badges" })).toHaveTextContent("None changed.");
  });
});
