import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { sellers } from "@/data/fixtures/sellers";
import {
  getCampuses,
  getCategories,
  getCollections,
  getFreeAndSwaps,
  getHeroSlides,
  getHubBanner,
  getJustListed,
} from "./index";

describe("placeholder art (spec section 12)", () => {
  it("exists for every image the data points at", async () => {
    const sources = [
      ...(await getCampuses()).map((campus) => campus.image.src),
      ...(await getCategories()).map((category) => category.image.src),
      ...(await getCollections()).map((collection) => collection.image.src),
      ...(await getHeroSlides()).map((slide) => slide.image.src),
      (await getHubBanner()).image.src,
      ...(await getJustListed({ campus: "all", limit: 1000 })).map((listing) => listing.image.src),
      ...(await getFreeAndSwaps({ campus: "all", limit: 1000 })).map((item) => item.image.src),
      ...sellers.map((seller) => seller.image.src),
    ];
    const missing = sources.filter((src) => !existsSync(join(process.cwd(), "public", src)));
    expect(missing).toEqual([]);
  });
});
