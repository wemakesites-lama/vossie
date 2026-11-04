"use server";
import { getReport } from "@/lib/data/staff-reports";
import { isId } from "@/lib/messaging/paths";
import { done } from "@/lib/selling/action-helpers";
import { requireStaffAction } from "./access";
import { canReadAgain, makeFirstRead } from "./first-read";
import { leaveNotice } from "./form-state";
import { ADMIN_REPORTS_PATH, adminReportPath } from "./paths";

/**
 * Read again (AI features spec 4.3, AI stage C planning decision 4): one more try at a report's first read. Only on an
 * open student's report with no read that isn't the admin's own, with the switch on; anything else changes nothing.
 * No audit entry, no tag and no one-time token: staff decide everything, and a second press when a read exists does
 * nothing. A failure leaves "first-read-failed"; a read leaves no notice (its box appears).
 */
export async function readReportAgain(formData: FormData): Promise<void> {
  const raw = formData.get("report");
  const id = typeof raw === "string" && isId(raw) ? raw : null;
  const staff = await requireStaffAction("admin", id ? adminReportPath(id) : ADMIN_REPORTS_PATH);
  if (!id) done(ADMIN_REPORTS_PATH);
  const now = new Date();
  const view = await getReport(id, staff.id);
  if (!view) done(ADMIN_REPORTS_PATH);
  if (canReadAgain(view) && (await makeFirstRead(id, now)) !== "saved") {
    // A read the after() call stored meanwhile is a read too: no failure notice then.
    if (!(await getReport(id, staff.id))?.firstRead) await leaveNotice("first-read-failed", now);
  }
  done(adminReportPath(id));
}
