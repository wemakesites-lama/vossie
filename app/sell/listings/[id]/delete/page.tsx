import type { Metadata } from "next";
import { Reveal } from "@/components/kit/Reveal";
import { DeleteListing } from "@/components/sell/DeleteListing";
import { SellDeleteSkeleton } from "@/components/sell/SellSkeleton";
import { PageTransition } from "@/components/kit/PageTransition";
import { Trail } from "@/components/ui/Trail";
import { trailFor } from "@/lib/nav/trail";

export const metadata: Metadata = { title: "Delete your listing", robots: { index: false } };

/** One sample, so the build checks the request-time part sits inside <Suspense> (CLAUDE.md). It matches no listing. */
export async function generateStaticParams() {
  return [{ id: "l-sample" }];
}

/** Delete listing (selling spec 2.9): the heading and the way back are prerendered; the listing streams in. */
export default function DeleteListingPage({ params }: PageProps<"/sell/listings/[id]/delete">) {
  return (
    <PageTransition>
      <div className="page sell-page">
        <div className="sell-column">
          <header className="sell-head">
            <Trail crumbs={trailFor("/sell/listings/[id]/delete", { names: { "/sell/listings/[id]/delete": "Delete this listing?" } })} />
            <h1 className="sell-title">Delete this listing?</h1>
          </header>
          <Reveal fallback={<SellDeleteSkeleton />}>
            <DeleteListing params={params} />
          </Reveal>
        </div>
      </div>
    </PageTransition>
  );
}
