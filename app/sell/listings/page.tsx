import type { Metadata } from "next";
import { Reveal } from "@/components/kit/Reveal";
import { MyListings } from "@/components/sell/MyListings";
import { SellFormSkeleton } from "@/components/sell/SellSkeleton";
import { PageTransition } from "@/components/kit/PageTransition";
import { Trail } from "@/components/ui/Trail";
import { trailFor } from "@/lib/nav/trail";

export const metadata: Metadata = { title: "Your listings", robots: { index: false } };

/**
 * Your listings (selling spec 2.9): the heading is prerendered; the tab and its listings stream in. New listing comes
 * with them, above the rows, or as an empty tab's own button, so it is never there twice (plan review fix 10).
 */
export default function MyListingsPage({ searchParams }: PageProps<"/sell/listings">) {
  return (
    <PageTransition>
      <div className="page sell-page">
        <div className="sell-column">
          <header className="sell-head">
            <Trail crumbs={trailFor("/sell/listings")} />
            <h1 className="sell-title">Your listings</h1>
          </header>
          <Reveal fallback={<SellFormSkeleton />}>
            <MyListings searchParams={searchParams} />
          </Reveal>
        </div>
      </div>
    </PageTransition>
  );
}
