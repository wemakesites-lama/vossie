import type { PickupPointRow } from "../lib/data/rows.ts";
import type { Campus, Category } from "../lib/types.ts";
import { insert, seedUuid } from "./seed-sql.ts";

// Production's reference data (supabase step 2b plan, Task 1; decisions 10 to 12): the allowed sign-in domains, the
// campuses, the categories and the pickup points, as supabase/migrations/20261021120000_reference_data.sql. It runs
// everywhere, production included; supabase/seed.sql adds only sample content on top.
//
// The migration is generated once, by scripts/make-reference.ts, and committed. A committed migration is never edited:
// when a fixture changes, reference-sql.test.ts fails, and the change goes into a new migration. Every insert skips rows
// that are already there, so a stack that has them from an older seed (staging) is unchanged.
//
// Pure: the fixtures come in as arguments, so Vitest and plain Node can both run it.

export type ReferenceFixtures = {
  campuses: readonly Campus[];
  categories: readonly Category[];
  /** The store's rows (data/fixtures/staff.ts), with the seed's fixed ids. */
  pickupPoints: readonly PickupPointRow[];
  /** lib/auth/config.ts's DEFAULT_EMAIL_DOMAINS, so the app's default list and the database's can't drift. */
  domains: readonly string[];
};

export function makeReferenceSql(f: ReferenceFixtures): string {
  const parts: string[] = [
    [
      "-- Production's reference data (supabase step 2b plan, Task 1; decisions 10 to 12): who may sign in, the campuses,",
      "-- the categories and the pickup points. Every environment runs it; supabase/seed.sql adds only sample content.",
      "-- Generated once by scripts/make-reference.ts from data/fixtures/ and lib/auth/config.ts. Never edit it: when a",
      "-- fixture changes, scripts/reference-sql.test.ts fails, and the change goes into a new migration.",
      "--",
      "-- Each insert skips rows that are already there, so a stack that has them from an older seed is unchanged.",
      "-- Exact domains only: students sign in as eduv and 7 digits @vossie.net, staff @eduvos.com (Lama, 2026-10-21).",
      "-- The pickup points keep the seed's fixed ids. They are sample places (\"Library entrance\" and \"Main reception\" on",
      "-- each campus) until Eduvos replaces them through the Hub (rename, retire, add): a go-live item.",
      "",
    ].join("\n"),
  ];

  parts.push("-- Who may sign in.");
  parts.push(
    insert(
      "private.allowed_email_domains",
      ["domain"],
      f.domains.map((domain) => [domain]),
      { onConflict: "do nothing" },
    ),
  );

  parts.push("-- Campuses and categories, in the fixtures' order.");
  parts.push(
    insert(
      "public.campuses",
      ["slug", "name", "region", "sort", "is_online"],
      f.campuses.map((campus, i) => [campus.slug, campus.name, campus.region, i + 1, campus.slug === "online"]),
      { onConflict: "do nothing" },
    ),
  );
  parts.push(
    insert(
      "public.categories",
      ["slug", "name", "sort"],
      f.categories.map((category, i) => [category.slug, category.name, i + 1]),
      { onConflict: "do nothing" },
    ),
  );

  parts.push("-- Pickup points, with the seed's fixed ids.");
  parts.push(
    insert(
      "public.pickup_points",
      ["id", "campus_slug", "name", "retired_at", "created_at"],
      f.pickupPoints.map((point) => [
        seedUuid("pickup-point", point.id),
        point.campusSlug,
        point.name,
        point.retiredAt,
        point.createdAt,
      ]),
      { onConflict: "do nothing" },
    ),
  );

  return parts.join("\n");
}
