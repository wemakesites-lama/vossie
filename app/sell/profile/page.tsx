import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeftIcon } from "@/components/icons";
import { Reveal } from "@/components/kit/Reveal";
import { SellFormSkeleton } from "@/components/sell/SellSkeleton";
import { ShopProfile } from "@/components/sell/ShopProfile";
import { SELL_PATH } from "@/lib/selling/paths";
import { PageTransition } from "@/components/kit/PageTransition";

export const metadata: Metadata = { title: "Edit your shop", robots: { index: false } };

/** Edit shop (selling spec 2.11): the heading is prerendered; the form streams in. */
export default function ShopProfilePage() {
  return (
    <PageTransition>
      <div className="page sell-page">
        <div className="sell-column">
          <header className="sell-head">
            <Link href={SELL_PATH} prefetch={false} className="sell-crumb">
              <ChevronLeftIcon className="size-4" />
              Your shop
            </Link>
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
