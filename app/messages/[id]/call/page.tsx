import type { Metadata } from "next";
import { PageTransition } from "@/components/kit/PageTransition";
import { Reveal } from "@/components/kit/Reveal";
import { OpenMockCall } from "@/components/messages/MockCall";
import { PageFallback } from "@/components/ui/PageFallback";

/** A call belongs to a conversation, so search engines leave it out, as the thread is. */
export const metadata: Metadata = { title: "Call", robots: { index: false } };

/** One sample id that matches no conversation, as the thread page's (messaging plan decision 25). */
export function generateStaticParams() {
  return [{ id: "conv-sample" }];
}

/** A thread's mock call (`lib/messaging/mock-call.ts`), for the demo only. */
export default function CallPage({ params }: PageProps<"/messages/[id]/call">) {
  return (
    <PageTransition>
      <div className="page thread-page">
        <Reveal fallback={<PageFallback />}>
          <CallForVisitor params={params} />
        </Reveal>
      </div>
    </PageTransition>
  );
}

async function CallForVisitor({ params }: Pick<PageProps<"/messages/[id]/call">, "params">) {
  const { id } = await params;
  return <OpenMockCall id={id} />;
}
