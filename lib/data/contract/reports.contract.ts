import { afterEach, beforeEach, expect, it } from "vitest";
import {
  countReportsSince,
  createReport,
  exportReports,
  hasOpenReport,
  listReportsBy,
} from "@/lib/data/reports";
import { reasonLabel } from "@/lib/messaging/rules";
import type { ReportTarget } from "@/lib/types";
import type { World } from "@/tests/contract/world";

// Students' reports in both backends (C2/C3 plan Task 13, decision 22; messaging spec 2.8 and 3.4, plan decisions 17
// and 18): making one, whether one is open, the day's count, the account's own list and its export. The target is a
// shop the world opens for "seller", so nothing of the seed is reported. reports.test.ts runs it on the sample store,
// reports.db.test.ts on the local stack.

const DAY = 24 * 60 * 60 * 1000;
const SHOP = "Contract reported shop";

export function reportsContract(makeWorld: () => World): void {
  let world: World;
  let target: ReportTarget;
  beforeEach(async () => {
    world = makeWorld();
    await world.tidySelling("seller");
    await world.tidyMessaging();
    target = { kind: "seller", id: await world.openShop("seller", { name: SHOP }) };
  });
  afterEach(async () => {
    await world.cleanup();
  });

  /** As sendReport does: a report only when the account has none open on the target (plan decision 17). */
  const report = (detail = "Selling copies.") =>
    world.asViewer("shopper", async (id) => {
      const now = new Date();
      return createReport({ reporterId: id, target, targetTitle: SHOP, reason: "spam", detail, now });
    });

  it("makes an open report and gives its id", async () => {
    expect(await report()).toEqual(expect.any(String));
    expect(await world.asViewer("shopper", (id) => hasOpenReport(id, target))).toBe(true);
    expect(await world.asViewer("asker", (id) => hasOpenReport(id, target))).toBe(false);
  });

  it("counts the account's reports in the last day", async () => {
    await report();
    const dayAgo = new Date(Date.now() - DAY);
    expect(await world.asViewer("shopper", (id) => countReportsSince(id, dayAgo))).toBe(1);
    expect(await world.asViewer("asker", (id) => countReportsSince(id, dayAgo))).toBe(0);
  });

  it("lists the account's own reports, and exports them with the reason's words and no ids", async () => {
    await report();
    const listed = await world.asViewer("shopper", (id) => listReportsBy(id));
    expect(listed).toEqual([{ kind: "seller", title: SHOP, reason: "spam", createdAt: expect.any(String), open: true }]);
    expect(listed[0].createdAt).toMatch(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/);
    expect(await world.asViewer("shopper", (id) => exportReports(id))).toEqual([
      { about: SHOP, kind: "seller", reason: reasonLabel("spam"), detail: "Selling copies.", at: listed[0].createdAt, status: "open" },
    ]);
    expect(await world.asViewer("asker", (id) => listReportsBy(id))).toEqual([]);
  });

  it("keeps one open report per target: a second press finds the first open (as the action asks)", async () => {
    const first = await report();
    const open = await world.asViewer("shopper", (id) => hasOpenReport(id, target));
    const again = open ? first : await report("Again.");
    expect(again).toBe(first);
    expect(await world.asViewer("shopper", (id) => listReportsBy(id))).toHaveLength(1);
  });
}
