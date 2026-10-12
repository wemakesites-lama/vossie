// Writes the labelled placeholder art the fixtures point at (spec section 12), at the final ratios. Swapping in a real
// photo later changes no layout: drop the file in and change its src in the fixture.
// Run from the project root: node scripts/make-placeholders.ts   (Node 26 runs TypeScript directly.)

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { campuses } from "../data/fixtures/campuses.ts";
import { categories } from "../data/fixtures/categories.ts";
import { collections } from "../data/fixtures/collections.ts";
import { freeSwapItems } from "../data/fixtures/free-swaps.ts";
import { heroSlides } from "../data/fixtures/hero.ts";
import { hubBanner } from "../data/fixtures/hub.ts";
import { listings } from "../data/fixtures/listings.ts";
import { sellers } from "../data/fixtures/sellers.ts";

type Art = { label: string | null; width: number; height: number };

// Final ratios from spec section 12. The phone hero crops the 16:10 art to 4:3; listing art is cropped to each card.
const SIZES: Record<string, [number, number]> = {
  hero: [1600, 1000],
  campus: [1200, 1200],
  category: [800, 800],
  collection: [960, 1200],
  hub: [2400, 1029],
  seller: [1000, 750],
  listing: [800, 800],
};

// Tiles and cards print their own text over or beside these, so only the larger photos carry a label. The Hub
// banner's heading sits right over its photo, so it has none either.
const LABELLED = new Set(["hero", "campus", "collection", "seller"]);

const art = new Map<string, Art>();

function add(src: string, label: string) {
  const folder = src.split("/")[2]; // "/placeholders/<folder>/<file>.svg"
  const size = SIZES[folder];
  if (!size) throw new Error(`No size for ${src}`);
  if (!art.has(src)) art.set(src, { label: LABELLED.has(folder) ? label : null, width: size[0], height: size[1] });
}

for (const slide of heroSlides) add(slide.image.src, `Photo: ${slide.word}`);
for (const campus of campuses) add(campus.image.src, `Photo: ${campus.name}`);
for (const category of categories) add(category.image.src, category.name);
for (const collection of collections) add(collection.image.src, `Photo: ${collection.eyebrow}`);
for (const seller of sellers) add(seller.image.src, `Photo: ${seller.name}`);
for (const listing of listings) add(listing.image.src, listing.title);
for (const item of freeSwapItems) add(item.image.src, item.title);
add(hubBanner.image.src, "Photo: the Incubation Hub");

const escapeXml = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// The mockup's placeholder look: a navy-to-sky gradient with faint diagonal stripes.
function svg({ label, width, height }: Art): string {
  const fontSize = Math.round(Math.min(width, height) / 18);
  const text = label
    ? `<text x="50%" y="50%" fill="#ffffff" font-family="system-ui, sans-serif" font-size="${fontSize}" font-weight="600" letter-spacing="1" text-anchor="middle" dominant-baseline="middle">${escapeXml(label.toUpperCase())}</text>`
    : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" preserveAspectRatio="xMidYMid slice">
<defs>
<linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1d3a68"/><stop offset=".55" stop-color="#2c6197"/><stop offset="1" stop-color="#7cbadc"/></linearGradient>
<pattern id="s" width="16" height="16" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="2" height="16" fill="#ffffff" fill-opacity=".06"/></pattern>
</defs>
<rect width="100%" height="100%" fill="url(#g)"/><rect width="100%" height="100%" fill="url(#s)"/>${text}
</svg>
`;
}

for (const [src, item] of art) {
  const file = join("public", src);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, svg(item));
}

console.log(`Wrote ${art.size} placeholders under public/placeholders.`);
