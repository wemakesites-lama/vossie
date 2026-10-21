import type { Metadata } from "next";
import { Suspense } from "react";
import { SellHome } from "@/components/sell/SellHome";
import { SellSkeleton } from "@/components/sell/SellSkeleton";

export const metadata: Metadata = { title: "Sell on CampusCart", robots: { index: false } };

/**
 * /sell (selling spec section 3): the pitch, the waiting page or the dashboard, chosen by the session, so it streams
 * in behind a skeleton. The header links here on every page, so nothing on it is a client component (plan decision 20).
 */
export default function SellPage() {
  return (
    <div className="page sell-page">
      <Suspense fallback={<SellSkeleton />}>
        <SellHome />
      </Suspense>
    </div>
  );
}
