import { Collections } from "@/components/home/Collections";
import { ContextStrip } from "@/components/home/ContextStrip";
import { FeaturedToday } from "@/components/home/FeaturedToday";
import { FreeAndSwaps } from "@/components/home/FreeAndSwaps";
import { Hero } from "@/components/home/hero/Hero";
import { HowItWorks } from "@/components/home/HowItWorks";
import { HubBanner } from "@/components/home/HubBanner";
import { JustListed } from "@/components/home/JustListed";
import { LookingFor } from "@/components/home/LookingFor";
import { ShopByCampus } from "@/components/home/ShopByCampus";
import { ShopByCategory } from "@/components/home/ShopByCategory";

/**
 * The homepage (spec section 7), in the approved order (decision 4). The campus-aware parts stream in behind
 * skeletons; everything else is prerendered.
 */
export default function HomePage() {
  return (
    <>
      <div className="home">
        <Hero />
        <ContextStrip />
        <ShopByCategory />
        <Collections />
        <ShopByCampus />
        <JustListed />
        <HowItWorks />
        <FeaturedToday />
        <LookingFor />
        <FreeAndSwaps />
      </div>
      {/* Full width, sitting on the footer (spec 7.13). */}
      <HubBanner />
    </>
  );
}
