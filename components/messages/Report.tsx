import { notFound } from "next/navigation";
import { readFormState } from "@/lib/auth/form-state";
import { requireAccount } from "@/lib/auth/session";
import { hasOpenReport } from "@/lib/data/reports";
import { reportFormKey, reportPath } from "@/lib/messaging/paths";
import { reportSubject } from "@/lib/messaging/subjects";
import type { ReportTarget } from "@/lib/types";
import { reportForm, ReportView } from "./ReportView";

/**
 * The report form for this request's visitor (messaging spec 2.8 and 3.4). Request-time: the page puts it inside
 * <Suspense>. Something that doesn't exist is the 404; a signed-out visitor goes to sign-in and back.
 */
export async function Report({ target }: { target: ReportTarget }) {
  const subject = await reportSubject(target);
  if (!subject) notFound();
  const account = await requireAccount(reportPath(target));
  const [already, state] = await Promise.all([hasOpenReport(account.id, target), readFormState(reportFormKey(target))]);
  return <ReportView target={target} subject={subject} already={already} form={reportForm(state, target)} />;
}
