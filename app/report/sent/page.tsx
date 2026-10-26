import type { Metadata } from "next";
import { Suspense } from "react";
import { PageTransition } from "@/components/kit/PageTransition";
import { ReportSentBack } from "@/components/messages/ReportSentBack";
import { Trail } from "@/components/ui/Trail";
import { trailFor } from "@/lib/nav/trail";

export const metadata: Metadata = { title: "Report sent", robots: { index: false } };

/**
 * The report's thank-you (messaging spec 3.4, plan decision 17): its own page, so reloading it doesn't bring the form
 * back. The words are prerendered; the way back reads the address, so it streams in.
 */
export default function ReportSentPage({ searchParams }: PageProps<"/report/sent">) {
  return (
    <PageTransition>
      <div className="page report-page">
        <div className="report-column">
          <Trail crumbs={trailFor("/report/sent")} />
          <h1 className="report-title">Report sent</h1>
          <p className="report-thanks">
            Thanks. The Hub reviews reports within two working days. We&apos;ll let you know what happens.
          </p>
          <div className="report-back">
            <Suspense fallback={null}>
              <BackFromAddress searchParams={searchParams} />
            </Suspense>
          </div>
        </div>
      </div>
    </PageTransition>
  );
}

async function BackFromAddress({ searchParams }: Pick<PageProps<"/report/sent">, "searchParams">) {
  return <ReportSentBack params={await searchParams} />;
}
