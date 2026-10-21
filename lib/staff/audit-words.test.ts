import { describe, expect, it } from "vitest";
import type { AuditAction } from "@/lib/types";
import { actionsOf, AUDIT_KINDS, auditKindOf, auditLabel, parseAuditFilter } from "./audit-words";

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
  "role-given",
  "role-removed",
  "listing-shown",
  "request-shown",
];

describe("the audit log's words (staff tools spec 2.2 and 2.3)", () => {
  it("words every action and files it under one of the eight kinds", () => {
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

describe("staff accounts and Show again (stage J spec decisions 7 and 14)", () => {
  it("words the role changes, filed under Staff accounts, the last kind in the filter", () => {
    expect(auditLabel("role-given")).toBe("Gave a staff role");
    expect(auditLabel("role-removed")).toBe("Removed a staff role");
    expect(auditKindOf("role-given")).toBe("staff");
    expect(auditKindOf("role-removed")).toBe("staff");
    expect(AUDIT_KINDS.at(-1)).toEqual({ kind: "staff", label: "Staff accounts" });
    expect(AUDIT_KINDS.at(-2)?.kind).toBe("mentoring");
  });

  it("words Show again, filed under Reports beside the hides", () => {
    expect(auditLabel("listing-shown")).toBe("Showed a listing again");
    expect(auditLabel("request-shown")).toBe("Showed a request again");
    expect(auditKindOf("listing-shown")).toBe("reports");
    expect(auditKindOf("request-shown")).toBe("reports");
  });

  it("reads kind=staff from the link", () => {
    expect(parseAuditFilter({ kind: "staff" })).toEqual({ staff: null, kind: "staff" });
  });
});

describe("actionsOf, the inverse of auditKindOf (C4/C5 plan Task 13)", () => {
  it("gives every action filed under a kind, and each action under exactly one kind", () => {
    for (const { kind } of AUDIT_KINDS) {
      expect(actionsOf(kind).every((action) => auditKindOf(action) === kind), kind).toBe(true);
    }
    expect(AUDIT_KINDS.flatMap(({ kind }) => actionsOf(kind)).sort()).toEqual([...EVERY_ACTION].sort());
    expect(actionsOf("shops")).toEqual([
      "shop-approved",
      "shop-declined",
      "shop-verified",
      "shop-unverified",
      "shop-paused",
      "shop-resumed",
    ]);
  });
});
