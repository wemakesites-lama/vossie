import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createReport } from "@/lib/data/reports";
import { getReport } from "@/lib/data/staff-reports";
import { resetSampleStore, sampleStore } from "@/lib/data/store";
import type { ReportTarget } from "@/lib/types";
import { ReportConfirm } from "./ReportConfirm";

vi.mock("@/lib/staff/admin-actions", () => ({
  hideReportedListing: async () => {},
  hideReportedRequest: async () => {},
  pauseReportedShop: async () => {},
}));

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

  it("asks before hiding a request, saying what students, the asker and the reporters see (community actions plan decision 20)", async () => {
    const report = await view({ kind: "request", id: "r-002" }, "Graphic calculator to borrow for exams");
    render(<ReportConfirm kind="hide" report={report} reason="" errors={[]} />);
    expect(
      screen.getByText("Hide Graphic calculator to borrow for exams? Students stop seeing it straight away."),
    ).toBeInTheDocument();
    expect(screen.getByText(/sees your reason in Your requests/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Hide Graphic calculator to borrow for exams" })).toBeInTheDocument();
    expect(document.querySelector('input[name="report"]')).toHaveValue(report.id);
    expect(screen.getByRole("link", { name: "Keep it" })).toHaveAttribute("href", `/admin/reports/${report.id}`);
  });

  it("offers Hide only for a listing or a request, whatever `can` says (amendment 14.4)", async () => {
    const report = await view({ kind: "seller", id: "tech-corner" }, "Tech corner");
    // Neither the listing's words and action nor the request's fit a shop, which is paused, not hidden.
    render(<ReportConfirm kind="hide" report={{ ...report, can: { hide: true, pause: false } }} reason="" errors={[]} />);
    expect(screen.getByText(/can't be hidden from this report/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to the report" })).toHaveAttribute("href", `/admin/reports/${report.id}`);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("says a request can't be hidden from a report that doesn't allow it, with the way back", async () => {
    const report = await view({ kind: "request", id: "r-002" }, "Graphic calculator to borrow for exams");
    sampleStore().requests.get("r-002")!.hiddenAt = NOW.toISOString();
    render(<ReportConfirm kind="hide" report={(await getReport(report.id))!} reason="" errors={[]} />);
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
