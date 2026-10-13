import type { HeroSlide } from "@/lib/types";

// Spec 7.3: one fixed headline frame with one changing word per slide.
export const heroSlides: readonly HeroSlide[] = [
  {
    id: "textbooks",
    word: "textbooks",
    body: "Set books and notes from students who aced the module, handed over at a campus pickup point.",
    cta: { label: "Shop textbooks", href: "/browse?cat=textbooks-notes" },
    image: { src: "/placeholders/hero/textbooks.svg", alt: "A student holding a stack of set books" },
  },
  {
    id: "tech",
    word: "tech",
    body: "Laptops, calculators and chargers from students on your campus, checked when you meet.",
    cta: { label: "Shop tech", href: "/browse?cat=tech" },
    image: { src: "/placeholders/hero/tech.svg", alt: "A student checking a laptop before buying it" },
  },
  {
    id: "services",
    word: "services",
    body: "Braids, tutoring, logos and repairs from students who do it well.",
    cta: { label: "Shop services", href: "/browse?cat=services" },
    image: { src: "/placeholders/hero/services.svg", alt: "A student braiding a classmate's hair" },
  },
];
