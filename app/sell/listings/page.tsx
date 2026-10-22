import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ChevronLeftIcon } from "@/components/icons";
import { MyListings } from "@/components/sell/MyListings";
import { SellFormSkeleton } from "@/components/sell/SellSkeleton";
import { NEW_LISTING_PATH, SELL_PATH } from "@/lib/selling/paths";
import { PageTransition } from "@/components/kit/PageTransition";

export const metadata: Metadata = { title: "My listings", robots: { index: false } };

/** My listings (selling spec 2.9): the heading is prerendered; the tab and its listings stream in. */
export default function MyListingsPage({ searchParams }: PageProps<"/sell/listings">) {
  return (
    <PageTransition>
      <div className="page sell-page">
        <div className="sell-column">
          <header className="sell-head">
            <Link href={SELL_PATH} prefetch={false} className="sell-crumb">
              <ChevronLeftIcon className="size-4" />
              Your shop
            </Link>
            <h1 className="sell-title">My listings</h1>
            <Link href={NEW_LISTING_PATH} prefetch={false} className="btn btn-primary">
              New listing
            </Link>
          </header>
          <Suspense fallback={<SellFormSkeleton />}>
            <MyListings searchParams={searchParams} />
          </Suspense>
        </div>
      </div>
    </PageTransition>
  );
}
