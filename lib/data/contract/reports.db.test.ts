import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isRefused } from "@/lib/data/refused";
import { createReport, deleteReportsBy, forgetReportOwner, listReportsBy } from "@/lib/data/reports";
import type { ReportTarget } from "@/lib/types";
import { supabaseWorld, type SupabaseWorld } from "@/tests/db/supabase-world";
import { reportsContract } from "./reports.contract";

// Students' reports on the local stack (C2/C3 plan Task 13): the contract, and what only Supabase has: create_report's
// own refusals as Refused (decision 22), its "already open" answer giving the open report's id, deletion's paths in
// the database (decision 21, amendment 4), and the account checked against the session (decision 2).
vi.mock("@/lib/data/supabase/clients", async (original) => (await import("@/tests/db/viewer")).withViewerSeam(await original()));

describe("students' reports on the local stack (C2/C3 plan Task 13)", () => {
  reportsContract(supabaseWorld);
});

describe("the report twins on the local stack (C2/C3 plan Task 13)", () => {
  let world: SupabaseWorld;
  let target: ReportTarget;
  let shopper: string;
  beforeEach(async () => {
    world = supabaseWorld();
    await world.tidySelling("seller");
    await world.tidyMessaging();
    shopper = await world.signedIn("shopper");
    target = { kind: "seller", id: await world.openShop("seller", { name: "Contract reported shop" }) };
  });
  afterEach(async () => {
    await world.cleanup();
  });

  const report = (to: ReportTarget, reporterId = shopper) =>
    world.asViewer("shopper", () =>
      createReport({ reporterId, target: to, targetTitle: "Contract reported shop", reason: "spam", detail: "", now: new Date() }),
    );

  it("gives the open report's id when one is open already (create_report's already-open)", async () => {
    const first = await report(target);
    expect(await report(target)).toBe(first);
    expect(await world.asViewer("shopper", (id) => listReportsBy(id))).toHaveLength(1);
  });

  it("throws Refused for an 11th report in 24 hours, made past the action's own count, and stores nothing", async () => {
    const made = await world.admin.from("reports").insert(
      Array.from({ length: 10 }, (_, n) => ({
        reporter_id: shopper,
        target_kind: "listing",
        target_id: `contract-r${n}`,
        target_title: "Something",
        reason: "spam",
      })),
    );
    if (made.error) throw new Error(made.error.message);
    const refused = await report(target).catch((error: unknown) => error);
    expect(isRefused(refused, "rate-limited")).toBe(true);
    expect(await world.asViewer("shopper", (id) => listReportsBy(id))).toHaveLength(10);
  });

  it("throws Refused for a target that isn't there (or isn't public) any more", async () => {
    const refused = await report({ kind: "seller", id: "contract-no-such-shop" }).catch((error: unknown) => error);
    expect(isRefused(refused, "not-found")).toBe(true);
  });

  it("leaves deletion's paths to the database (forget_account), with a plain Error", async () => {
    await expect(world.asViewer("shopper", () => deleteReportsBy(shopper))).rejects.toThrow(
      "deleteReportsBy runs in the database on Supabase",
    );
    await expect(world.asViewer("shopper", () => forgetReportOwner(shopper))).rejects.toThrow(
      "forgetReportOwner runs in the database on Supabase",
    );
  });

  it("throws for a reporter that isn't the signed-in account", async () => {
    const asker = await world.signedIn("asker");
    await expect(report(target, asker)).rejects.toThrow("isn't the signed-in one");
  });
});
