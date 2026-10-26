import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageTransition } from "@/components/kit/PageTransition";
import { Reveal } from "@/components/kit/Reveal";
import { Report } from "@/components/messages/Report";
import { ReportSkeleton } from "@/components/messages/ReportSkeleton";
import { parseReportTarget } from "@/lib/messaging/paths";

/** A form for one visitor, so search engines leave it out (plan decision 24). */
export const metadata: Metadata = { title: "Report", robots: { index: false } };

/**
 * Report a listing, a seller or a request (messaging spec 2.8 and 3.4): `/report?listing=l-001`. The address and the
 * session are read per request, inside <Suspense>; an address that names nothing reportable is the 404.
 */
export default function ReportPage({ searchParams }: PageProps<"/report">) {
  return (
    <PageTransition>
      <div className="page report-page">
        <Reveal fallback={<ReportSkeleton />}>
          <ReportForVisitor searchParams={searchParams} />
        </Reveal>
      </div>
    </PageTransition>
  );
}

async function ReportForVisitor({ searchParams }: Pick<PageProps<"/report">, "searchParams">) {
  const target = parseReportTarget(await searchParams);
  if (!target) notFound();
  return <Report target={target} />;
}
