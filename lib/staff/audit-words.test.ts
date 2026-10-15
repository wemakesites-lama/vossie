import { describe, expect, it } from "vitest";
import type { AuditAction } from "@/lib/types";
import { AUDIT_KINDS, auditKindOf, auditLabel, FORMER_STAFF, parseAuditFilter } from "./audit-words";

const EVERY_ACTION: AuditAction[] = [
  "shop-approved",
  "shop-declined",
  "shop-verified",
  "shop-unverified",
  "shop-paused",
  "shop-resumed",
  "mentor-assigned",
  "mentor-removed",
  "report-dismissed",
  "listing-hidden",
  "listing-shown",
  "featured-pinned",
  "featured-unpinned",
  "point-added",
  "point-renamed",
  "point-retired",
  "point-restored",
  "post-created",
  "post-updated",
  "booking-accepted",
  "booking-declined",
  "note-added",
  "check-in-added",
  "note-deleted",
  "check-in-deleted",
];

describe("the audit log's words (staff tools spec 2.2 and 2.3)", () => {
  it("words every action and files it under one of the seven kinds", () => {
    const kinds = new Set(AUDIT_KINDS.map((item) => item.kind));
    for (const action of EVERY_ACTION) {
      expect(auditLabel(action), action).toMatch(/^[A-Z]/);
      expect(kinds.has(auditKindOf(action)), action).toBe(true);
    }
    expect(auditLabel("listing-hidden")).toBe("Hid a listing");
    expect(auditKindOf("booking-accepted")).toBe("office-hours");
  });

  it("files showing a listing again with hiding it, and deletions with mentoring (amendments 16 and 18)", () => {
    expect(auditLabel("listing-shown")).toBe("Showed a hidden listing again");
    expect(auditKindOf("listing-shown")).toBe(auditKindOf("listing-hidden"));
    expect(auditLabel("note-deleted")).toBe("Deleted a mentor's note");
    expect(auditLabel("check-in-deleted")).toBe("Deleted a check-in");
    expect(auditKindOf("note-deleted")).toBe("mentoring");
    expect(auditKindOf("check-in-deleted")).toBe("mentoring");
  });

  it("names a deleted staff member's entries (amendment 17)", () => {
    expect(FORMER_STAFF).toBe("Former staff member");
  });

  it("reads the filters from the link, ignoring what it doesn't know", () => {
    expect(parseAuditFilter({ staff: "acc-admin", kind: "reports" })).toEqual({ staff: "acc-admin", kind: "reports" });
    expect(parseAuditFilter({ staff: ["acc-mentor", "acc-admin"], kind: "nope" })).toEqual({
      staff: "acc-mentor",
      kind: null,
    });
    expect(parseAuditFilter({ staff: "<script>" })).toEqual({ staff: null, kind: null });
  });
});
