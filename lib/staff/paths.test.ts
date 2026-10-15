import { describe, expect, it } from "vitest";
import {
  adminReportPath,
  adminSellerPath,
  AREA_HOME,
  auditPath,
  bookSlotPath,
  declineSellerPath,
  editPostPath,
  hideReportedPath,
  mentorShopPath,
  pauseReportedPath,
  pauseSellerPath,
  STAFF_SECTIONS,
} from "./paths";

describe("the staff pages' addresses (staff tools spec section 3)", () => {
  it("puts every page under /admin, /hub or /mentor", () => {
    expect(adminSellerPath("tech-corner")).toBe("/admin/sellers/tech-corner");
    expect(declineSellerPath("tech-corner")).toBe("/admin/sellers/tech-corner/decline");
    expect(pauseSellerPath("tech-corner")).toBe("/admin/sellers/tech-corner/pause");
    expect(adminReportPath("rep-1")).toBe("/admin/reports/rep-1");
    expect(hideReportedPath("rep-1")).toBe("/admin/reports/rep-1/hide");
    expect(pauseReportedPath("rep-1")).toBe("/admin/reports/rep-1/pause");
    expect(editPostPath("h-001")).toBe("/hub/h-001/edit");
    expect(bookSlotPath("h-002")).toBe("/hub/h-002/book");
    expect(mentorShopPath("tech-corner")).toBe("/mentor/tech-corner");
  });

  it("filters the audit log by staff member and kind in the link (spec 2.3)", () => {
    expect(auditPath({ staff: null, kind: null })).toBe("/admin/audit");
    expect(auditPath({ staff: "acc-admin", kind: null })).toBe("/admin/audit?staff=acc-admin");
    expect(auditPath({ staff: "acc-admin", kind: "reports" })).toBe("/admin/audit?staff=acc-admin&kind=reports");
  });

  it("lists the frame's sections, the admin console's six first", () => {
    expect(STAFF_SECTIONS.map((section) => section.label)).toEqual([
      "Overview",
      "Sellers",
      "Reports",
      "Featured",
      "Pickup points",
      "Audit log",
      "Hub posts",
      "Mentoring",
    ]);
    expect(AREA_HOME.hub).toEqual({ href: "/hub/manage", label: "Hub posts and office hours" });
  });
});
