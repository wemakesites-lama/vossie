import { describe, expect, it, vi } from "vitest";
import { listAudit, recordAudit } from "@/lib/data/audit";
import { actionContract } from "@/tests/contract/actions";
import { dbActions } from "@/tests/db/actions";
import { supabaseWorld } from "@/tests/db/supabase-world";
import { withViewer } from "@/tests/db/viewer";
import type { FakeRequest } from "@/tests/helpers/next-request";
import { auditContract } from "./audit.contract";

// The audit log on the local stack (C4/C5 plan Task 13): audit_log read as the admin (its policy), written only by the
// staff functions.
const request = vi.hoisted((): FakeRequest => ({ cookies: new Map(), sent: new Map(), proto: "http" }));
vi.mock("next/headers", async () => (await import("@/tests/helpers/next-request")).nextHeaders(request));
vi.mock("next/navigation", async () => (await import("@/tests/helpers/next-request")).nextNavigation());
vi.mock("next/server", async () => (await import("@/tests/helpers/next-request")).nextServer());
vi.mock("next/cache", async () => (await import("@/tests/helpers/next-request")).nextCache(request));
vi.mock("@/lib/data/supabase/clients", async (original) => (await import("@/tests/db/viewer")).withViewerSeam(await original()));
vi.mock("@/lib/data/supabase/auth-session", async (original) =>
  (await import("@/tests/db/viewer")).withSessionSeam(await original<object>()),
);

describe("the audit log on the local stack (C4/C5 plan Task 13)", () => {
  actionContract(supabaseWorld, request, dbActions, auditContract);
});

describe("the audit log's Supabase-only rules (C4/C5 plan Task 13)", () => {
  it("is hidden from someone without the admin role, by its policy", async () => {
    expect(await withViewer("asker", () => listAudit({ staff: null, kind: null }))).toEqual([]);
  });

  it("has no TypeScript writer: the staff functions write the row (decision 3)", async () => {
    await expect(
      recordAudit({
        staff: { id: "x", firstName: "X" },
        action: "shop-approved",
        target: { kind: "shop", id: "x", name: "X" },
        now: new Date(),
      }),
    ).rejects.toThrow("the staff function writes the audit row");
  });
});
