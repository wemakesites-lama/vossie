import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const SUPABASE_ONLY_IN_DATA =
  "Only lib/data and lib/supabase talk to Supabase (backend spec, supabase foundation plan Task 12). Go through lib/data.";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Supabase stays behind lib/data: nothing else imports its clients or its packages, so no page or component can reach
  // the database, or a secret key, directly. tests/db is `pnpm test:db`'s harness (its accounts, sessions and world),
  // which lib/data/boundaries.test.ts also allows (2b plan Task 13).
  {
    files: ["**/*.{js,jsx,mjs,cjs,ts,tsx,mts,cts}"],
    ignores: ["lib/data/**", "lib/supabase/**", "tests/db/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            { group: ["@/lib/supabase", "@/lib/supabase/*", "**/lib/supabase", "**/lib/supabase/*"], message: SUPABASE_ONLY_IN_DATA },
            { group: ["@supabase/*"], message: SUPABASE_ONLY_IN_DATA },
          ],
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Reference material and tool output:
    "docs/**",
    "vossie-audit/**",
    ".superpowers/**",
    "playwright-report/**",
    "test-results/**",
  ]),
]);

export default eslintConfig;
