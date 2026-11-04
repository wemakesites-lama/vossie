import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { firstReadLines, type FirstRead as Read } from "@/lib/staff/report-read";
import { FirstRead } from "./FirstRead";

vi.mock("@/lib/staff/report-read-actions", () => ({ readReportAgain: async () => {} }));

const READ: Read = { summary: "A report about a fake designer bag.", concern: "counterfeit", agrees: true };

describe("the report read's box (AI features spec section 4, stage C)", () => {
  it("shows the read's three lines in a region above the reporter's words, with no controls", () => {
    render(<FirstRead reportId="rep-1" read={READ} reason="prohibited" readAgain />);
    const box = screen.getByRole("region", { name: "First read (may be wrong)" });
    const lines = firstReadLines(READ, "prohibited");
    expect(within(box).getByText(lines.summary)).toBeInTheDocument();
    expect(within(box).getByText("May break: counterfeit goods")).toBeInTheDocument();
    expect(within(box).getByText("Agrees with the reporter's reason (Prohibited item)")).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("offers Read again when there's no read and the report allows it", () => {
    render(<FirstRead reportId="rep-1" read={null} reason="scam" readAgain />);
    expect(screen.queryByRole("region", { name: "First read (may be wrong)" })).toBeNull();
    expect(screen.getByText("No first read of this report yet.")).toBeInTheDocument();
    const button = screen.getByRole("button", { name: "Read again" });
    expect(button).toHaveAttribute("type", "submit");
    expect(button.closest("form")!.querySelector('input[type="hidden"][name="report"]')).toHaveValue("rep-1");
  });

  it("shows nothing when there's no read and Read again isn't allowed", () => {
    const { container } = render(<FirstRead reportId="rep-1" read={null} reason="scam" readAgain={false} />);
    expect(container).toBeEmptyDOMElement();
  });
});
