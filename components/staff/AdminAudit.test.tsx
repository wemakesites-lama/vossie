import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { auditStaff, listAudit, recordAudit } from "@/lib/data/audit";
import { resetSampleStore } from "@/lib/data/store";
import { AdminAudit } from "./AdminAudit";

const NOW = new Date("2026-10-14T08:42:00.000Z");

beforeEach(async () => {
  resetSampleStore();
  await recordAudit({
    staff: { id: "acc-mentor", firstName: "Naledi" },
    action: "note-added",
    target: { kind: "shop", id: "tech-corner", name: "Tech corner" },
    now: new Date("2026-10-14T08:00:00.000Z"),
  });
  await recordAudit({
    staff: { id: "acc-admin", firstName: "Pieter" },
    action: "listing-hidden",
    target: { kind: "listing", id: "l-001", name: "Desk lamp" },
    detail: "Not allowed on CampusCart.",
    now: NOW,
  });
});

describe("the audit log (staff tools spec 2.2 and 2.3, plan decision 6)", () => {
  it("lists entries newest first: when in SAST, who, what, about what, and why", async () => {
    render(<AdminAudit entries={await listAudit({ staff: null, kind: null })} staff={await auditStaff()} filter={{ staff: null, kind: null }} />);
    const table = screen.getByRole("table", { name: "The audit log, newest first" });
    const [, first, second] = within(table).getAllByRole("row");
    expect(within(first).getAllByRole("cell").map((cell) => cell.textContent)).toEqual([
      "WhenWed 14 Oct · 10:42",
      "WhoPieter",
      "WhatHid a listing",
      "AboutDesk lamp",
      "DetailNot allowed on CampusCart.",
    ]);
    expect(within(second).getByRole("cell", { name: "Added a mentor's note" })).toBeInTheDocument();
  });

  it("filters by staff member and by kind, as links, marking the ones chosen", async () => {
    render(<AdminAudit entries={[]} staff={await auditStaff()} filter={{ staff: "acc-admin", kind: "reports" }} />);
    const filters = screen.getByRole("navigation", { name: "Filter the log" });
    expect(within(filters).getByRole("link", { name: "Everyone" })).toHaveAttribute("href", "/admin/audit?kind=reports");
    expect(within(filters).getByRole("link", { name: "Pieter" })).toHaveAttribute("aria-current", "true");
    expect(within(filters).getByRole("link", { name: "Naledi" })).toHaveAttribute(
      "href",
      "/admin/audit?staff=acc-mentor&kind=reports",
    );
    expect(within(filters).getByRole("link", { name: "Reports" })).toHaveAttribute("aria-current", "true");
    expect(within(filters).getByRole("link", { name: "Every kind" })).toHaveAttribute("href", "/admin/audit?staff=acc-admin");
    expect(screen.getByText("Nothing in the log matches.")).toBeInTheDocument();
  });
});
