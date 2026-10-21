// Prints production's reference data migration (supabase step 2b plan, Task 1). It was run once, from the project root:
//   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/make-reference.ts > supabase/migrations/20261021120000_reference_data.sql
// The migration is committed and never edited. scripts/reference-sql.test.ts fails when the fixtures no longer match it:
// then write a new migration for the change.

import { registerHooks } from "node:module";

// As scripts/make-seed.ts: a relative import with no extension is tried as ".ts", and the fixtures are loaded with
// import() below, after the hook is registered.
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (/^\.\.?\//.test(specifier) && !/\.[cm]?[jt]sx?$/.test(specifier)) {
      return nextResolve(`${specifier}.ts`, context);
    }
    return nextResolve(specifier, context);
  },
});

const [{ makeReferenceSql }, { campuses }, { categories }, { samplePickupPointRows }, { DEFAULT_EMAIL_DOMAINS }] =
  await Promise.all([
    import("./reference-sql.ts"),
    import("../data/fixtures/campuses.ts"),
    import("../data/fixtures/categories.ts"),
    import("../data/fixtures/staff.ts"),
    import("../lib/auth/config.ts"),
  ]);

process.stdout.write(
  makeReferenceSql({ campuses, categories, pickupPoints: samplePickupPointRows, domains: DEFAULT_EMAIL_DOMAINS }),
);
