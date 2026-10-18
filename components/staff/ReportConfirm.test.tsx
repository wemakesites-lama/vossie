import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createReport } from "@/lib/data/reports";
import { getReport } from "@/lib/data/staff-reports";
import { resetSampleStore } from "@/lib/data/store";
import type { ReportTarget } from "@/lib/types";
import { ReportConfirm } from "./ReportConfirm";

vi.mock("@/lib/staff/admin-actions", () => ({ hideReportedListing: async () => {}, pauseReportedShop: async () => {} }));

const NOW = new Date("2026-10-14T08:42:00.000Z");

beforeEach(() => {
  resetSampleStore();
});

async function view(target: ReportTarget, targetTitle: string) {
  const id = await createReport({ reporterId: "acc-student", target, targetTitle, reason: "scam", detail: "", now: NOW });
  return (await getReport(id))!;
}

describe("the reports' confirm pages (staff tools spec 2.9, plan decision 18)", () => {
  it("asks before hiding a listing, saying what buyers, the seller and the reporters see", async () => {
    const report = await view({ kind: "listing", id: "l-001" }, "Casio fx-991ZA Plus calculator");
    render(<ReportConfirm kind="hide" report={report} reason="" errors={[]} />);
    expect(screen.getByText("Hide Casio fx-991ZA Plus calculator? Buyers stop seeing it straight away.")).toBeInTheDocument();
    expect(screen.getByText(/Every open report about it closes/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Hide Casio fx-991ZA Plus calculator" })).toBeInTheDocument();
    expect(document.querySelector('input[name="report"]')).toHaveValue(report.id);
    expect(screen.getByRole("link", { name: "Keep it" })).toHaveAttribute("href", `/admin/reports/${report.id}`);
  });

  it("offers Hide only for a listing, so stage H can add its own branch for a request (amendment 14.4)", async () => {
    const report = await view({ kind: "request", id: "r-001" }, "A Looking For request");
    // Whatever `can` says, the listing's words and action don't fit a request.
    render(<ReportConfirm kind="hide" report={{ ...report, can: { hide: true, pause: false } }} reason="" errors={[]} />);
    expect(screen.getByText(/can't be hidden from this report/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to the report" })).toHaveAttribute("href", `/admin/reports/${report.id}`);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("asks before pausing the shop behind a report", async () => {
    const report = await view({ kind: "listing", id: "l-001" }, "Casio fx-991ZA Plus calculator");
    render(<ReportConfirm kind="pause" report={report} reason="" errors={[]} />);
    expect(screen.getByText("Pause Tech corner? Buyers stop seeing it straight away.")).toBeInTheDocument();
    expect(
      screen.getByText("Every open report about the shop or its listings closes, and each reporter hears that the Hub acted."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pause Tech corner" })).toBeInTheDocument();
  });

  it("says when the report doesn't allow it, with the way back", async () => {
    const report = await view({ kind: "listing", id: "l-004" }, "Box braids, shoulder length");
    render(<ReportConfirm kind="pause" report={report} reason="" errors={[]} />);
    expect(screen.getByText(/can't be paused from this report/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to the report" })).toHaveAttribute("href", `/admin/reports/${report.id}`);
    expect(screen.queryByRole("button")).toBeNull();
  });
});
