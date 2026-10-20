import { describe, expect, it } from "vitest";
import {
  ADMIN_HIDDEN_PATH,
  ADMIN_NUMBERS_PATH,
  ADMIN_STAFF_PATH,
  adminReportPath,
  adminSellerPath,
  AREA_HOME,
  auditPath,
  bookSlotPath,
  declineSellerPath,
  editPostPath,
  hideReportedPath,
  mentorShopPath,
  numbersPath,
  pauseReportedPath,
  pauseSellerPath,
  removeRolePath,
  showListingPath,
  showRequestPath,
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

describe("stage J's addresses (spec section 3)", () => {
  it("puts staff accounts, the numbers and the hidden list under /admin", () => {
    expect(ADMIN_STAFF_PATH).toBe("/admin/staff");
    expect(ADMIN_NUMBERS_PATH).toBe("/admin/numbers");
    expect(ADMIN_HIDDEN_PATH).toBe("/admin/hidden");
    expect(removeRolePath("acc-mentor", "mentor")).toBe("/admin/staff/acc-mentor/remove-mentor");
    expect(removeRolePath("acc-admin", "admin")).toBe("/admin/staff/acc-admin/remove-admin");
    expect(showListingPath("l-001")).toBe("/admin/hidden/listings/l-001");
    expect(showRequestPath("r-001")).toBe("/admin/hidden/requests/r-001");
  });

  it("puts a campus's view of the numbers in the link", () => {
    expect(numbersPath(null)).toBe("/admin/numbers");
    expect(numbersPath("midrand")).toBe("/admin/numbers?campus=midrand");
  });
});
