import type { Metadata } from "next";
import { Suspense } from "react";
import { SellHome } from "@/components/sell/SellHome";
import { SellSkeleton } from "@/components/sell/SellSkeleton";
import { PageTransition } from "@/components/kit/PageTransition";
import { Trail } from "@/components/ui/Trail";
import { trailFor } from "@/lib/nav/trail";

export const metadata: Metadata = { title: "Sell on CampusCart", robots: { index: false } };

/**
 * /sell (selling spec section 3): the pitch, the waiting page or the dashboard, chosen by the session, so it streams
 * in behind a skeleton. The header links here on every page, so nothing on it is a client component (plan decision 20).
 */
export default function SellPage() {
  return (
    <PageTransition>
      <div className="page sell-page">
        {/* In the column, as the other Selling pages' trails are, so it doesn't jump between tabs. */}
        <div className="sell-trail">
          <Trail crumbs={trailFor("/sell")} />
        </div>
        {/* Plain Suspense, not Reveal (calm navigation Task 4): a reveal waits for the fonts, so the pitch and the font
            swap shift together, and the visitor's /sell measured 0.0676 against 0.0598 without it. */}
        <Suspense fallback={<SellSkeleton />}>
          <SellHome />
        </Suspense>
      </div>
    </PageTransition>
  );
}
