import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { campuses } from "@/data/fixtures/campuses";
import { categories } from "@/data/fixtures/categories";
import { samplePickupPointRows } from "@/data/fixtures/staff";
import { DEFAULT_EMAIL_DOMAINS } from "@/lib/auth/config";
import { makeReferenceSql, type ReferenceFixtures } from "./reference-sql";
import { seedUuid } from "./seed-sql";

const MIGRATION = "supabase/migrations/20261021120000_reference_data.sql";

const fixtures: ReferenceFixtures = {
  campuses,
  categories,
  pickupPoints: samplePickupPointRows,
  domains: DEFAULT_EMAIL_DOMAINS,
};

/** The rows of one table's INSERT, one string a row (each value list without its line indent or trailing comma). */
function rowsOf(sql: string, table: string): string[] {
  const start = sql.indexOf(`insert into ${table} (`);
  if (start < 0) return [];
  const end = sql.indexOf("\non conflict do nothing;\n", start);
  return sql
    .slice(start, end)
    .split("\n")
    .slice(1)
    .map((line) => line.trim().replace(/,$/, ""));
}

const q = (text: string) => `'${text.replace(/'/g, "''")}'`;

describe("production's reference rows and allowed domains (step 2b plan, Task 1; decisions 10 to 12)", () => {
  it("writes one insert that skips existing rows per table, domains first", () => {
    const sql = makeReferenceSql(fixtures);
    const tables = [...sql.matchAll(/^insert into ([a-z_.]+) \(/gm)].map((match) => match[1]);
    expect(tables).toEqual([
      "private.allowed_email_domains",
      "public.campuses",
      "public.categories",
      "public.pickup_points",
    ]);
    expect(sql.match(/\non conflict do nothing;\n/g)).toHaveLength(4);
  });

  it("allows eduvos.com and vossie.net, and never the seed's vossie.test", () => {
    const sql = makeReferenceSql(fixtures);
    expect(rowsOf(sql, "private.allowed_email_domains")).toEqual(["('eduvos.com')", "('vossie.net')"]);
    expect(sql).not.toContain("vossie.test");
  });

  it("holds the 13 campuses (Online last) and 10 categories in the fixtures' order", () => {
    const sql = makeReferenceSql(fixtures);
    expect(rowsOf(sql, "public.campuses")).toEqual(
      campuses.map(
        (campus, i) => `(${q(campus.slug)}, ${q(campus.name)}, ${q(campus.region)}, ${i + 1}, ${campus.slug === "online"})`,
      ),
    );
    expect(rowsOf(sql, "public.campuses")).toHaveLength(13);
    expect(rowsOf(sql, "public.categories")).toEqual(
      categories.map((category, i) => `(${q(category.slug)}, ${q(category.name)}, ${i + 1})`),
    );
    expect(rowsOf(sql, "public.categories")).toHaveLength(10);
  });

  it("holds the 24 pickup points with the seed's fixed ids, none retired, created when the store says", () => {
    const sql = makeReferenceSql(fixtures);
    expect(sql).toContain("insert into public.pickup_points (id, campus_slug, name, retired_at, created_at) values\n");
    expect(rowsOf(sql, "public.pickup_points")).toEqual(
      samplePickupPointRows.map(
        (point) =>
          `(${q(seedUuid("pickup-point", point.id))}, ${q(point.campusSlug)}, ${q(point.name)}, null, '2025-01-15T08:00:00.000Z')`,
      ),
    );
    expect(rowsOf(sql, "public.pickup_points")).toHaveLength(24);
  });

  it("is the committed migration, byte for byte", () => {
    const onDisk = readFileSync(join(process.cwd(), MIGRATION), "utf8");
    expect(
      onDisk === makeReferenceSql(fixtures),
      `${MIGRATION} no longer matches the fixtures. A committed migration is never edited: write a new migration for the change`,
    ).toBe(true);
  });
});
