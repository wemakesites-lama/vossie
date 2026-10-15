import type { Metadata } from "next";
import { Suspense } from "react";
import { DeleteListing } from "@/components/sell/DeleteListing";
import { SellFormSkeleton } from "@/components/sell/SellSkeleton";

export const metadata: Metadata = { title: "Delete a listing", robots: { index: false } };

/** One sample, so the build checks the request-time part sits inside <Suspense> (CLAUDE.md). It matches no listing. */
export async function generateStaticParams() {
  return [{ id: "l-sample" }];
}

/** Delete listing (selling spec 2.9): the heading is prerendered; the listing streams in. */
export default function DeleteListingPage({ params }: PageProps<"/sell/listings/[id]/delete">) {
  return (
    <div className="page sell-page">
      <div className="sell-column">
        <h1 className="sell-title">Delete this listing?</h1>
        <Suspense fallback={<SellFormSkeleton />}>
          <DeleteListing params={params} />
        </Suspense>
      </div>
    </div>
  );
}
