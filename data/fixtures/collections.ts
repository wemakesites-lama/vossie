import type { Collection, CollectionRule } from "@/lib/types";

const collection = (
  slug: string,
  eyebrow: string,
  title: string,
  intro: string,
  rule: CollectionRule,
): Collection => ({
  slug,
  eyebrow,
  title,
  image: { src: `/placeholders/collection/${slug}.svg`, alt: title },
  intro,
  rule,
});

// Curated by the Incubation Hub for the season (spec 7.6). Each is a rule, like a saved browse, so it fills itself as
// listings come and go (shopping spec 6.1). The intros are sample wording for the Hub to change.
export const collections: readonly Collection[] = [
  collection(
    "start-of-semester", "Start of semester", "Back-to-campus essentials",
    "Books, stationery and tech to start the semester ready.",
    { categories: ["textbooks-notes", "stationery", "tech"] },
  ),
  collection(
    "exam-season", "Exam season", "Notes, tutors & cram snacks",
    "Everything for exam season, from summaries to snacks.",
    { categories: ["textbooks-notes", "tutoring", "food"] },
  ),
  collection(
    "moving-in", "Moving in", "Res setup under R500",
    "Make your room a home without breaking the bank.",
    { categories: ["res-living"], maxPrice: 500 },
  ),
  collection(
    "skills-for-hire", "Skills for hire", "Book a student",
    "Skills for hire from students on every campus.",
    { categories: ["services", "tutoring", "hair-beauty"] },
  ),
];
