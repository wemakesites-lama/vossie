import type { Campus } from "@/lib/types";

const campus = (slug: string, name: string, region: string, liveListings: number): Campus => ({
  slug,
  name,
  region,
  liveListings,
  image: { src: `/campus/${slug}.jpg`, alt: `${name} campus` },
});

// The 12 Eduvos campuses in alphabetical order, then Eduvos Online. Listing counts are samples.
export const campuses: readonly Campus[] = [
  campus("bedfordview", "Bedfordview", "Gauteng", 132),
  campus("bloemfontein", "Bloemfontein", "Free State", 58),
  campus("cape-town-mowbray", "Cape Town Mowbray", "Western Cape", 96),
  campus("cape-town-tyger-valley", "Cape Town Tyger Valley", "Western Cape", 87),
  campus("durban-umhlanga", "Durban Umhlanga", "KwaZulu-Natal", 74),
  campus("east-london", "East London", "Eastern Cape", 31),
  campus("mbombela", "Mbombela", "Mpumalanga", 22),
  campus("midrand", "Midrand", "Gauteng", 214),
  campus("nelson-mandela-bay", "Nelson Mandela Bay", "Eastern Cape", 45),
  campus("potchefstroom", "Potchefstroom", "North West", 39),
  campus("pretoria", "Pretoria", "Gauteng", 187),
  campus("vanderbijlpark", "Vanderbijlpark", "Gauteng", 51),
  campus("online", "Eduvos Online", "Online, anywhere in SA", 63),
];
