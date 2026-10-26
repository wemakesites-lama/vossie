import type { Metadata } from "next";
import { PageTransition } from "@/components/kit/PageTransition";
import { Reveal } from "@/components/kit/Reveal";
import { Offer, OfferSkeleton } from "@/components/looking-for/Offer";

/** One shop's form, so search engines leave it out (plan decision 23). */
export const metadata: Metadata = { title: "Offer to help", robots: { index: false } };

/** One sample id, so the build checks the page keeps its request-time parts inside <Suspense> (plan decision 24). */
export function generateStaticParams() {
  return [{ id: "r-001" }];
}

/** The offer composer (community actions spec 2.9), laid out like E's. It renders per request inside <Suspense>. */
export default function OfferPage({ params }: PageProps<"/looking-for/[id]/offer">) {
  return (
    <PageTransition>
      <div className="page composer-page offer-page">
        <Reveal fallback={<OfferSkeleton />}>
          <OfferForVisitor params={params} />
        </Reveal>
      </div>
    </PageTransition>
  );
}

async function OfferForVisitor({ params }: Pick<PageProps<"/looking-for/[id]/offer">, "params">) {
  const { id } = await params;
  return <Offer requestId={id} />;
}
