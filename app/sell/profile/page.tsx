import type { Metadata } from "next";
import { Reveal } from "@/components/kit/Reveal";
import { SellFormSkeleton } from "@/components/sell/SellSkeleton";
import { ShopProfile } from "@/components/sell/ShopProfile";
import { PageTransition } from "@/components/kit/PageTransition";
import { Trail } from "@/components/ui/Trail";
import { trailFor } from "@/lib/nav/trail";

export const metadata: Metadata = { title: "Edit your shop", robots: { index: false } };

/** Edit shop (selling spec 2.11): the heading is prerendered; the form streams in. */
export default function ShopProfilePage() {
  return (
    <PageTransition>
      <div className="page sell-page">
        <div className="sell-column">
          <header className="sell-head">
            <Trail crumbs={trailFor("/sell/profile")} />
            <h1 className="sell-title">Edit your shop</h1>
          </header>
          <Reveal fallback={<SellFormSkeleton />}>
            <ShopProfile />
          </Reveal>
        </div>
      </div>
    </PageTransition>
  );
}
