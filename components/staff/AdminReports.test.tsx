import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { createReport } from "@/lib/data/reports";
import { closeReport, listReports } from "@/lib/data/staff-reports";
import { resetSampleStore } from "@/lib/data/store";
import { AdminReports } from "./AdminReports";

const NOW = new Date("2026-10-14T08:42:00.000Z");

beforeEach(() => {
  resetSampleStore();
});

describe("the reports queue (staff tools spec 2.3)", () => {
  it("lists open reports first with what, why and who by first name, then closed ones with what was done", async () => {
    const closed = await createReport({
      reporterId: "acc-mentor",
      target: { kind: "seller", id: "tech-corner" },
      targetTitle: "Tech corner",
      reason: "spam",
      detail: "",
      now: NOW,
    });
    await createReport({
      reporterId: "acc-student",
      target: { kind: "listing", id: "l-004" },
      targetTitle: "Box braids, shoulder length",
      reason: "scam",
      detail: "Asked for a deposit.",
      now: NOW,
    });
    await closeReport(closed, "Looked fine.", "acc-admin", NOW);
    render(<AdminReports reports={await listReports()} />);
    const open = screen.getByRole("table", { name: "Open reports, oldest first" });
    const [, row] = within(open).getAllByRole("row");
    expect(within(row).getByRole("cell", { name: "Listing: Box braids, shoulder length" })).toBeInTheDocument();
    expect(within(row).getByRole("cell", { name: "Scam or fraud" })).toBeInTheDocument();
    expect(within(row).getByRole("cell", { name: "Thandi" })).toBeInTheDocument();
    expect(within(row).getByRole("link", { name: "Review the report about Box braids, shoulder length" })).toHaveAttribute(
      "href",
      expect.stringMatching(/^\/admin\/reports\/rep-[0-9a-f-]{36}$/),
    );
    const done = screen.getByRole("table", { name: "Closed recently" });
    expect(within(done).getByRole("cell", { name: "Dismissed" })).toBeInTheDocument();
    expect(within(done).getByRole("cell", { name: "Pieter" })).toBeInTheDocument();
  });

  it("says when there's nothing open, or nothing closed", () => {
    render(<AdminReports reports={[]} />);
    expect(screen.getByText("No open reports.")).toBeInTheDocument();
    expect(screen.getByText("Nothing closed yet.")).toBeInTheDocument();
  });
});
