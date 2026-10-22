import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ChevronLeftIcon } from "@/components/icons";
import { ListingForm } from "@/components/sell/ListingForm";
import { SellFormSkeleton } from "@/components/sell/SellSkeleton";
import { myListingsPath } from "@/lib/selling/paths";
import { PageTransition } from "@/components/kit/PageTransition";

export const metadata: Metadata = { title: "New listing", robots: { index: false } };

/** A new listing (selling spec 2.10): the heading is prerendered; the form streams in. */
export default function NewListingPage() {
  return (
    <PageTransition>
      <div className="page sell-page">
        <div className="sell-column">
          <header className="sell-head">
            <Link href={myListingsPath()} prefetch={false} className="sell-crumb">
              <ChevronLeftIcon className="size-4" />
              Your listings
            </Link>
            <h1 className="sell-title">New listing</h1>
          </header>
          <Suspense fallback={<SellFormSkeleton />}>
            <ListingForm />
          </Suspense>
        </div>
      </div>
    </PageTransition>
  );
}
