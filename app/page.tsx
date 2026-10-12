import { Collections } from "@/components/home/Collections";
import { ContextStrip } from "@/components/home/ContextStrip";
import { Hero } from "@/components/home/hero/Hero";
import { ShopByCampus } from "@/components/home/ShopByCampus";
import { ShopByCategory } from "@/components/home/ShopByCategory";

// Sections that haven't landed yet hold their place, so the page stays about as tall as the finished one and the
// header's scroll tests keep their room. Each section's task swaps its slot comment for the section and takes its
// name off this list. Task 21 removes the list.
const COMING_IN_PART_2 = [
  "Just listed",
  "How it works",
  "Featured today",
  "Looking For",
  "Free & swaps",
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
        {/* Task 16: <JustListed /> */}
        {/* Task 17: <HowItWorks /> */}
        {/* Task 18: <FeaturedToday /> */}
        {/* Task 19: <LookingFor /> */}
        {/* Task 20: <FreeAndSwaps /> */}
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
