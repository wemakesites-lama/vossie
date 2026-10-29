import type { Category } from "@/lib/types";

const category = (slug: string, name: string): Category => ({
  slug,
  name,
  image: { src: `/stock/category/${slug}.jpg`, alt: name },
});

// Confirmed by Lama on 2026-10-08; may change later, which is why they live in data.
export const categories: readonly Category[] = [
  category("textbooks-notes", "Textbooks & notes"),
  category("tech", "Tech"),
  category("res-living", "Res & living"),
  category("fashion-thrift", "Fashion & thrift"),
  category("food", "Food"),
  category("hair-beauty", "Hair & beauty"),
  category("tutoring", "Tutoring"),
  category("services", "Services"),
  category("tickets-events", "Tickets & events"),
  category("stationery", "Stationery"),
];
