import Link from "next/link";
import { parseReportTarget } from "@/lib/messaging/paths";
import { reportSubject } from "@/lib/messaging/subjects";

/** The thank-you's way back to what was reported (spec 3.4), from its address; home when that names nothing. */
export async function ReportSentBack({ params }: { params: Readonly<Record<string, string | string[] | undefined>> }) {
  const target = parseReportTarget(params);
  const subject = target ? await reportSubject(target) : null;
  if (!subject) {
    return (
      <Link href="/" className="btn btn-outline text-navy">
        Back to the homepage
      </Link>
    );
  }
  return (
    <Link href={subject.href} prefetch={false} className="btn btn-primary">
      {subject.backLabel}
    </Link>
  );
}
