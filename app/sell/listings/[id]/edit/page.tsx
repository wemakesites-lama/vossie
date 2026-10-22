import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ChevronLeftIcon } from "@/components/icons";
import { ListingForm } from "@/components/sell/ListingForm";
import { SellFormSkeleton } from "@/components/sell/SellSkeleton";
import { myListingsPath } from "@/lib/selling/paths";
import { PageTransition } from "@/components/kit/PageTransition";

export const metadata: Metadata = { title: "Edit listing", robots: { index: false } };

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
            <Link href={myListingsPath()} prefetch={false} className="sell-crumb">
              <ChevronLeftIcon className="size-4" />
              My listings
            </Link>
            <h1 className="sell-title">Edit listing</h1>
          </header>
          <Suspense fallback={<SellFormSkeleton />}>
            <ListingForm params={params} />
          </Suspense>
        </div>
      </div>
    </PageTransition>
  );
}
