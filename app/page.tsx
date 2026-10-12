import { Collections } from "@/components/home/Collections";
import { ContextStrip } from "@/components/home/ContextStrip";
import { FeaturedToday } from "@/components/home/FeaturedToday";
import { FreeAndSwaps } from "@/components/home/FreeAndSwaps";
import { Hero } from "@/components/home/hero/Hero";
import { HowItWorks } from "@/components/home/HowItWorks";
import { JustListed } from "@/components/home/JustListed";
import { LookingFor } from "@/components/home/LookingFor";
import { ShopByCampus } from "@/components/home/ShopByCampus";
import { ShopByCategory } from "@/components/home/ShopByCategory";

// Sections that haven't landed yet hold their place, so the page stays about as tall as the finished one and the
// header's scroll tests keep their room. Each section's task swaps its slot comment for the section and takes its
// name off this list. Task 21 removes the list.
const COMING_IN_PART_2 = [
  "Hub and What's on",
];

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
        <ol aria-label="Homepage sections still to come" className="mt-12 grid gap-4">
          {COMING_IN_PART_2.map((name) => (
            <li
              key={name}
              className="grid min-h-[38vh] place-items-center rounded-panel border-[1.5px] border-dashed border-line text-muted"
            >
              {name}
            </li>
          ))}
        </ol>
      </div>
      {/* Task 21: <HubBanner /> */}
    </>
  );
}
