import type { Seller } from "@/lib/types";

const seller = (
  slug: string,
  name: string,
  tagline: string,
  category: string,
  campusSlug: string,
  verified = true,
): Seller => ({
  slug,
  name,
  tagline,
  category,
  campusSlug,
  verified,
  image: { src: `/placeholders/seller/${slug}.svg`, alt: `The ${name.toLowerCase()} at work` },
});

// Generic names (spec 13), not the old demo's sellers. Only verified sellers are featured.
export const sellers: readonly Seller[] = [
  seller("hair-studio", "Hair studio", "Braids, cornrows and wash days on campus.", "Hair & beauty", "midrand"),
  seller("maths-tutor", "Maths tutor", "Exam prep that sticks, one hour at a time.", "Tutoring", "midrand"),
  seller("home-bakery", "Home bakery", "Cupcakes and cookie boxes for any occasion.", "Food", "midrand"),
  seller("design-studio", "Design studio", "Logos and posters for student hustles.", "Services", "midrand"),
  seller("thrift-rack", "Thrift rack", "Pre-loved jackets and denim, washed and pressed.", "Fashion & thrift", "pretoria"),
  seller("code-coach", "Code coach", "Python and Java help before your practicals.", "Tutoring", "pretoria"),
  seller("phone-fix", "Phone fix", "Cracked screens and batteries, same day.", "Services", "bedfordview"),
  seller("nail-bar", "Nail bar", "Gel, acrylics and nail art between lectures.", "Hair & beauty", "cape-town-tyger-valley"),
  seller("study-notes", "Study notes", "Typed summaries for first-year modules.", "Textbooks & notes", "online"),
  seller("res-kitchen", "Res kitchen", "Home-cooked lunch boxes, ordered by 10am.", "Food", "durban-umhlanga", false),
];
