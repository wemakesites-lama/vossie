import type { Metadata } from "next";
import { Reveal } from "@/components/kit/Reveal";
import { ListingForm } from "@/components/sell/ListingForm";
import { SellFormSkeleton } from "@/components/sell/SellSkeleton";
import { PageTransition } from "@/components/kit/PageTransition";
import { Trail } from "@/components/ui/Trail";
import { trailFor } from "@/lib/nav/trail";

export const metadata: Metadata = { title: "New listing", robots: { index: false } };

/** A new listing (selling spec 2.10): the heading is prerendered; the form streams in. */
export default function NewListingPage() {
  return (
    <PageTransition>
      <div className="page sell-page">
        <div className="sell-column">
          <header className="sell-head">
            <Trail crumbs={trailFor("/sell/listings/new")} />
            <h1 className="sell-title">New listing</h1>
          </header>
          <Reveal fallback={<SellFormSkeleton />}>
            <ListingForm />
          </Reveal>
        </div>
      </div>
    </PageTransition>
  );
}
