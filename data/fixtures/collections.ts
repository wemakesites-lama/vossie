import type { Collection } from "@/lib/types";

const collection = (slug: string, eyebrow: string, title: string): Collection => ({
  slug,
  eyebrow,
  title,
  image: { src: `/placeholders/collection/${slug}.svg`, alt: title },
});

// Curated by the Incubation Hub for the season (spec 7.6).
export const collections: readonly Collection[] = [
  collection("start-of-semester", "Start of semester", "Back-to-campus essentials"),
  collection("exam-season", "Exam season", "Notes, tutors & cram snacks"),
  collection("moving-in", "Moving in", "Res setup under R500"),
  collection("skills-for-hire", "Skills for hire", "Book a student"),
];
