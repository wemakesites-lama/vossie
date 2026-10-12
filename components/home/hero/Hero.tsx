import { Suspense } from "react";
import { getHeroSlides } from "@/lib/data";
import { joinWords } from "@/lib/format";
import { HeroCampusChip, HeroCampusChipFallback } from "./HeroCampusChip";
import { HeroRotator } from "./HeroRotator";

/** The hero (spec 7.3). The slides are prerendered; only the phone's campus chip waits for the cookie. */
export async function Hero() {
  const slides = await getHeroSlides();
  return (
    <section aria-labelledby="hero-title">
      <HeroRotator
        slides={slides}
        sentence={`Buy & sell ${joinWords(slides.map((slide) => slide.word))} on campus`}
        chip={
          <Suspense fallback={<HeroCampusChipFallback />}>
            <HeroCampusChip />
          </Suspense>
        }
      />
    </section>
  );
}
