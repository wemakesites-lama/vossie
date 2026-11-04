import { afterEach, beforeEach, expect, it } from "vitest";
import { fileListingCheckReport, forgetReportOwner, reportForRead, saveFirstRead } from "@/lib/data/reports";
import { getReport, listReports } from "@/lib/data/staff-reports";
import type { FirstRead } from "@/lib/staff/report-read";
import type { World } from "@/tests/contract/world";

// The report read (AI stage C, plan Task 3), the same in both backends: report-read.test.ts runs it on the sample store
// (`pnpm test`), report-read.db.test.ts on the local stack (`pnpm test:db`). Deleting the owner's account strips the read:
// on the sample store through forgetReportOwner, on Supabase through the target_owner_id trigger (63_report_read.test.sql).

const READ: FirstRead = { summary: "A watch sold as a Rolex.", concern: "counterfeit", agrees: true };

export function reportReadContract(makeWorld: () => World): void {
  let world: World;
  beforeEach(() => {
    world = makeWorld();
  });
  afterEach(async () => {
    await world.cleanup();
  });

  const asStaff = <T>(read: (staffId: string) => Promise<T>) => world.asViewer("staff", read);

  it("reads a student's report, stores one read, and shows it to an admin", async () => {
    const slug = await world.openShop("seller", { name: "Contract read watches" });
    const listing = await world.addListing(slug, { title: "Contract read watch" });
    const id = await world.addReport("shopper", { kind: "listing", id: listing });
    expect(await reportForRead(id)).toMatchObject({
      target: { kind: "listing", id: listing },
      open: true,
      gone: false,
      read: false,
    });
    expect((await asStaff((staffId) => getReport(id, staffId)))?.firstRead).toBeNull();
    expect(await saveFirstRead(id, READ)).toBe("saved");
    expect(await saveFirstRead(id, { ...READ, concern: "none" })).toBe("already");
    expect(await reportForRead(id)).toMatchObject({ read: true });
    expect((await asStaff((staffId) => getReport(id, staffId)))?.firstRead).toEqual(READ);
  });

  it("never reads the listing check's reports", async () => {
    const slug = await world.openShop("seller", { name: "Contract read checked watches" });
    const listing = await world.addListing(slug, { title: "Contract read checked watch" });
    const owner = await world.signedIn("seller");
    expect(
      await world.asViewer("seller", () =>
        fileListingCheckReport({ listingId: listing, ownerId: owner, concern: "counterfeit", now: new Date() }),
      ),
    ).toBe("filed");
    const checked = (await asStaff(() => listReports())).find(
      (view) => view.target.id === listing && view.reporterId === null,
    );
    expect(checked).toBeDefined();
    expect(await reportForRead(checked!.id)).toBeNull();
    expect(await saveFirstRead(checked!.id, READ)).toBe("not-found");
  });

  it("strips the read when the owner's account is deleted (sample store; Supabase's trigger is in pgTAP)", async () => {
    if (world.name !== "sample") return;
    const slug = await world.openShop("seller", { name: "Contract read gone watches" });
    const listing = await world.addListing(slug, { title: "Contract read gone watch" });
    const id = await world.addReport("shopper", { kind: "listing", id: listing });
    await saveFirstRead(id, READ);
    await forgetReportOwner(await world.signedIn("seller"));
    expect((await asStaff((staffId) => getReport(id, staffId)))?.firstRead).toBeNull();
  });
}
