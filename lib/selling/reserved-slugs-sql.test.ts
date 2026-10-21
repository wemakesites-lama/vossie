import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { RESERVED_SLUGS, slugify } from "./rules";

// RESERVED_SLUGS and the database's private.reserved_shop_slugs() change together (C2/C3 plan decision 7): a waiting
// shop's link is made in SQL (create_shop, update_shop), and a word only the app knew would give it a link a fixed
// route uses. This reads the function's latest definition in the migrations and compares the two lists.

const MIGRATIONS = join(process.cwd(), "supabase", "migrations");
const DEFINITION = /create (?:or replace )?function private\.reserved_shop_slugs\(\)[\s\S]*?\$\$([\s\S]*?)\$\$/g;

function sqlReservedSlugs(): string[] | null {
  let latest: string | null = null;
  for (const file of readdirSync(MIGRATIONS).filter((name) => name.endsWith(".sql")).sort()) {
    for (const match of readFileSync(join(MIGRATIONS, file), "utf8").matchAll(DEFINITION)) latest = match[1];
  }
  if (latest === null) return null;
  const array = /array\[([^\]]*)\]/.exec(latest);
  if (!array) return null;
  return [...array[1].matchAll(/'([^']*)'/g)].map((word) => word[1]);
}

describe("the reserved links in SQL (C2/C3 plan decision 7)", () => {
  it("are RESERVED_SLUGS, word for word", () => {
    expect(sqlReservedSlugs()?.sort()).toEqual([...RESERVED_SLUGS].sort());
  });

  it("and the app's slugify still turns each into another link", () => {
    for (const word of RESERVED_SLUGS) expect(slugify(word)).toBe(`${word}-shop`);
  });
});
