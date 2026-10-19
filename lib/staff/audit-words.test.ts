import { describe, expect, it } from "vitest";
import type { AuditAction } from "@/lib/types";
import { AUDIT_KINDS, auditKindOf, auditLabel, parseAuditFilter } from "./audit-words";

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
  "request-hidden",
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

  it("reads the filters from the link, ignoring what it doesn't know", () => {
    expect(parseAuditFilter({ staff: "acc-admin", kind: "reports" })).toEqual({ staff: "acc-admin", kind: "reports" });
    expect(parseAuditFilter({ staff: ["acc-mentor", "acc-admin"], kind: "nope" })).toEqual({
      staff: "acc-mentor",
      kind: null,
    });
    expect(parseAuditFilter({ staff: "<script>" })).toEqual({ staff: null, kind: null });
  });
});

describe("hiding a request (community actions plan decision 20)", () => {
  it("is Hid a request, filed under Reports", () => {
    expect(auditLabel("request-hidden")).toBe("Hid a request");
    expect(auditKindOf("request-hidden")).toBe("reports");
  });
});
