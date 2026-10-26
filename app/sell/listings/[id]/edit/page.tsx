import type { Metadata } from "next";
import { Reveal } from "@/components/kit/Reveal";
import { ListingForm } from "@/components/sell/ListingForm";
import { SellFormSkeleton } from "@/components/sell/SellSkeleton";
import { PageTransition } from "@/components/kit/PageTransition";
import { Trail } from "@/components/ui/Trail";
import { trailFor } from "@/lib/nav/trail";

export const metadata: Metadata = { title: "Edit your listing", robots: { index: false } };

/** One sample, so the build checks the request-time part sits inside <Suspense> (CLAUDE.md). It matches no listing. */
export async function generateStaticParams() {
  return [{ id: "l-sample" }];
}

/** Editing a listing (selling spec 2.10): the heading is prerendered; the form streams in. */
export default function EditListingPage({ params }: PageProps<"/sell/listings/[id]/edit">) {
  return (
    <PageTransition>
      <div className="page sell-page">
        <div className="sell-column">
          <header className="sell-head">
            <Trail crumbs={trailFor("/sell/listings/[id]/edit", { names: { "/sell/listings/[id]/edit": "Edit listing" } })} />
            <h1 className="sell-title">Edit listing</h1>
          </header>
          <Reveal fallback={<SellFormSkeleton />}>
            <ListingForm params={params} />
          </Reveal>
        </div>
      </div>
    </PageTransition>
  );
}
