import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createReport } from "@/lib/data/reports";
import { hideRequest } from "@/lib/data/requests";
import { hideListing } from "@/lib/data/staff-shops";
import { closeReport, closeReportsOn, getReport } from "@/lib/data/staff-reports";
import { resetSampleStore, sampleStore } from "@/lib/data/store";
import type { ReportTarget } from "@/lib/types";
import { AdminReport, ownReportLine } from "./AdminReport";

vi.mock("@/lib/staff/admin-actions", () => ({ dismissReport: async () => {} }));

const NOW = new Date("2026-10-14T08:42:00.000Z");

beforeEach(() => {
  resetSampleStore();
});

async function reportOn(target: ReportTarget, targetTitle: string) {
  const id = await createReport({
    reporterId: "acc-student",
    target,
    targetTitle,
    reason: "misleading",
    detail: "The photo isn't the item.",
    now: NOW,
  });
  return id;
}

describe("a report's page (staff tools spec 2.3, plan decision 5)", () => {
  it("shows the target, the reason, the detail and the reporter's first name, with what the Hub can do", async () => {
    const id = await reportOn({ kind: "listing", id: "l-001" }, "Casio fx-991ZA Plus calculator");
    render(<AdminReport report={(await getReport(id))!} note="" errors={[]} />);
    const facts = screen.getByRole("region", { name: "The report" });
    expect(within(facts).getByRole("link", { name: "Casio fx-991ZA Plus calculator" })).toHaveAttribute(
      "href",
      "/listings/l-001",
    );
    expect(within(facts).getByText("Misleading listing")).toBeInTheDocument();
    expect(within(facts).getByText("The photo isn't the item.")).toBeInTheDocument();
    expect(within(facts).getByText("Thandi")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Hide Casio fx-991ZA Plus calculator" })).toHaveAttribute(
      "href",
      `/admin/reports/${id}/hide`,
    );
    expect(screen.getByRole("link", { name: "Pause Tech corner" })).toHaveAttribute("href", `/admin/reports/${id}/pause`);
    expect(screen.getByLabelText("Note")).toHaveAccessibleDescription("Only Hub staff see it. Up to 500 characters.");
    expect(screen.getByRole("button", { name: "Dismiss the report about Casio fx-991ZA Plus calculator" })).toHaveAttribute(
      "type",
      "submit",
    );
    expect(document.querySelector('input[name="report"]')).toHaveValue(id);
  });

  it("doesn't link a listing the Hub has hidden, and says buyers can't see it", async () => {
    const id = await reportOn({ kind: "listing", id: "l-001" }, "Casio fx-991ZA Plus calculator");
    sampleStore().listings.get("l-001")!.hiddenAt = NOW.toISOString();
    render(<AdminReport report={(await getReport(id))!} note="" errors={[]} />);
    const facts = screen.getByRole("region", { name: "The report" });
    expect(within(facts).queryByRole("link")).toBeNull();
    expect(within(facts).getByText("Casio fx-991ZA Plus calculator")).toBeInTheDocument();
    expect(within(facts).getByText("Buyers can't see this listing: the Hub has hidden it.")).toBeInTheDocument();
  });

  it("doesn't link a shop the Hub has paused, and says buyers can't see it while the pause lasts", async () => {
    const id = await reportOn({ kind: "seller", id: "tech-corner" }, "Tech corner");
    sampleStore().sellerProfiles.get("acc-seller")!.status = "paused";
    sampleStore().sellerProfiles.get("acc-seller")!.pausedBy = "staff";
    render(<AdminReport report={(await getReport(id))!} note="" errors={[]} />);
    const facts = screen.getByRole("region", { name: "The report" });
    expect(within(facts).queryByRole("link")).toBeNull();
    expect(within(facts).getByText("Buyers can't see this shop while the Hub's pause lasts.")).toBeInTheDocument();
  });

  it("offers Hide for a report about a request, and Dismiss (community actions plan decision 20)", async () => {
    const id = await reportOn({ kind: "request", id: "r-001" }, "Looking for a lab coat");
    render(<AdminReport report={(await getReport(id))!} note="" errors={[]} />);
    expect(screen.getByRole("link", { name: "Hide Looking for a lab coat" })).toHaveAttribute(
      "href",
      `/admin/reports/${id}/hide`,
    );
    expect(screen.queryByRole("link", { name: /^Pause / })).toBeNull();
    expect(screen.queryByText(/can only be dismissed/)).toBeNull();
    expect(screen.getByRole("button", { name: "Dismiss the report about Looking for a lab coat" })).toBeInTheDocument();
  });

  it("doesn't link a request the Hub has hidden, and says students can't see it (amendment 8)", async () => {
    const id = await reportOn({ kind: "request", id: "r-001" }, "Looking for a lab coat");
    sampleStore().requests.get("r-001")!.hiddenAt = NOW.toISOString();
    render(<AdminReport report={(await getReport(id))!} note="" errors={[]} />);
    const facts = screen.getByRole("region", { name: "The report" });
    expect(within(facts).queryByRole("link")).toBeNull();
    expect(within(facts).getByText("Looking for a lab coat")).toBeInTheDocument();
    expect(within(facts).getByText("Students can't see this request: the Hub has hidden it.")).toBeInTheDocument();
    expect(within(facts).queryByText(/Buyers can't see this listing/)).toBeNull();
    // Hidden already, so Hide has gone, and the report can only be dismissed.
    expect(screen.queryByRole("link", { name: /^Hide / })).toBeNull();
    expect(screen.getByText(/can only be dismissed/)).toBeInTheDocument();
  });

  it("says a hidden request was hidden once its report is closed", async () => {
    const id = await reportOn({ kind: "request", id: "r-001" }, "Looking for a lab coat");
    await closeReportsOn({ kind: "request", id: "r-001" }, "hidden", "Not allowed.", "acc-admin", NOW);
    render(<AdminReport report={(await getReport(id))!} note="" errors={[]} />);
    expect(screen.getByText("Request hidden on 14 October 2026 by Pieter.")).toBeInTheDocument();
    expect(screen.getByText("Not allowed.")).toBeInTheDocument();
  });

  it("links a request that's up to its page", async () => {
    const id = await reportOn({ kind: "request", id: "r-001" }, "Looking for a lab coat");
    render(<AdminReport report={(await getReport(id))!} note="" errors={[]} />);
    const facts = screen.getByRole("region", { name: "The report" });
    expect(within(facts).getByRole("link", { name: "Looking for a lab coat" })).toHaveAttribute("href", "/looking-for/r-001");
    expect(within(facts).queryByText(/can't see this/)).toBeNull();
  });

  it("keeps the note typed before a failed Dismiss, with what's wrong", async () => {
    const id = await reportOn({ kind: "listing", id: "l-004" }, "Box braids, shoulder length");
    const errors = [{ message: "Add a note to say what you found.", fieldId: `dismiss-${id}-note` }];
    render(<AdminReport report={(await getReport(id))!} note="" errors={errors} />);
    expect(screen.getByRole("alert", { name: "There's a problem" })).toBeInTheDocument();
    expect(screen.getByLabelText("Note")).toHaveAttribute("aria-invalid", "true");
  });

  it("says what was done once it's closed, with no actions left", async () => {
    const id = await reportOn({ kind: "listing", id: "l-004" }, "Box braids, shoulder length");
    await closeReport(id, "Looked fine.", "acc-admin", NOW);
    render(<AdminReport report={(await getReport(id))!} note="" errors={[]} />);
    expect(screen.getByText("Dismissed on 14 October 2026 by Pieter.")).toBeInTheDocument();
    expect(screen.getByText("Looked fine.")).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
  });
});

describe("Show it again (stage J spec decision 14, plan decision 18)", () => {
  it("links a closed report's hidden listing to its Show again page", async () => {
    const id = await reportOn({ kind: "listing", id: "l-001" }, "Casio fx-991ZA Plus calculator");
    await hideListing("l-001", "Not allowed.", NOW);
    await closeReportsOn({ kind: "listing", id: "l-001" }, "hidden", "Not allowed.", "acc-admin", NOW);
    render(<AdminReport report={(await getReport(id))!} note="" errors={[]} />);
    const facts = screen.getByRole("region", { name: "The report" });
    expect(within(facts).getByText("Buyers can't see this listing: the Hub has hidden it.")).toBeInTheDocument();
    expect(within(facts).getByRole("link", { name: "Show it again" })).toHaveAttribute("href", "/admin/hidden/listings/l-001");
  });

  it("links a closed report's hidden request to its Show again page", async () => {
    const id = await reportOn({ kind: "request", id: "r-001" }, "Looking for a lab coat");
    await hideRequest("r-001", "Not allowed.", NOW);
    await closeReportsOn({ kind: "request", id: "r-001" }, "hidden", "Not allowed.", "acc-admin", NOW);
    render(<AdminReport report={(await getReport(id))!} note="" errors={[]} />);
    expect(screen.getByRole("link", { name: "Show it again" })).toHaveAttribute("href", "/admin/hidden/requests/r-001");
  });

  it("offers nothing on a report that's still open, or whose target is there to see", async () => {
    const id = await reportOn({ kind: "listing", id: "l-001" }, "Casio fx-991ZA Plus calculator");
    render(<AdminReport report={(await getReport(id))!} note="" errors={[]} />);
    expect(screen.queryByRole("link", { name: "Show it again" })).toBeNull();
  });
});

describe("a report about the admin's own (stage L spec section 3)", () => {
  it("says so in place of Hide, Pause and Dismiss", async () => {
    const id = await reportOn({ kind: "listing", id: "l-001" }, "Casio fx-991ZA Plus calculator");
    render(<AdminReport report={(await getReport(id, "acc-seller"))!} note="" errors={[]} />);
    const actions = screen.getByRole("region", { name: "What you can do" });
    expect(actions).toHaveTextContent("This report is about your own listing, so another admin must handle it.");
    expect(within(actions).queryByRole("link")).toBeNull();
    expect(within(actions).queryByRole("button")).toBeNull();
    expect(within(actions).queryByRole("textbox")).toBeNull();
  });

  it("names a shop and a request in the same words", () => {
    expect(ownReportLine("shop")).toBe("This report is about your own shop, so another admin must handle it.");
    expect(ownReportLine("request")).toBe("This report is about your own request, so another admin must handle it.");
  });

  it("offers no Show it again on a closed report about the admin's own hidden listing", async () => {
    const id = await reportOn({ kind: "listing", id: "l-001" }, "Casio fx-991ZA Plus calculator");
    await hideListing("l-001", "Checking it.", NOW);
    await closeReportsOn({ kind: "listing", id: "l-001" }, "hidden", "Checking it.", "acc-admin", NOW);
    render(<AdminReport report={(await getReport(id, "acc-seller"))!} note="" errors={[]} />);
    expect(screen.queryByRole("link", { name: "Show it again" })).toBeNull();
  });
});
