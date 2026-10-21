import { describe, expect, it } from "vitest";
import { campuses } from "@/data/fixtures/campuses";
import { categories } from "@/data/fixtures/categories";
import { ONLINE_CAMPUS } from "@/lib/campus";
import { testAdminClient } from "@/tests/db/accounts";

// Campuses and categories are read from the code's fixtures in both backends (2b plan decision 14). The database's rows
// come from the reference migration; this keeps the two equal, so a new campus is a code change and a migration.

describe("the database's reference rows equal the fixtures (2b plan Task 14, decision 14)", () => {
  it("has the same campuses, in the same order, with Eduvos Online the one online campus", async () => {
    const { data, error } = await testAdminClient().from("campuses").select("slug, name, region, sort, is_online").order("sort");
    expect(error).toBeNull();
    expect(data).toEqual(
      campuses.map((campus, i) => ({
        slug: campus.slug,
        name: campus.name,
        region: campus.region,
        sort: i + 1,
        is_online: campus.slug === ONLINE_CAMPUS,
      })),
    );
  });

  it("has the same categories, in the same order", async () => {
    const { data, error } = await testAdminClient().from("categories").select("slug, name, sort").order("sort");
    expect(error).toBeNull();
    expect(data).toEqual(categories.map((category, i) => ({ slug: category.slug, name: category.name, sort: i + 1 })));
  });
});
