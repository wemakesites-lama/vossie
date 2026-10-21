import { fileURLToPath } from "node:url";
import { configDefaults, defineConfig } from "vitest/config";

// `pnpm test:db`: the *.db.test.ts files, against the local Supabase stack (2b plan decision 18, Task 12; amendment 20).
// Start the stack and reset it first (`supabase db reset`); tests/db/global-setup.ts says so when it's down. Node, not jsdom: these tests talk to the database. One file
// at a time, since they share the stack's rows.
export default defineConfig({
  resolve: {
    tsconfigPaths: true,
    // "server-only" throws outside a React Server Components bundle; the twins are plain modules here.
    alias: { "server-only": fileURLToPath(new URL("./tests/db/empty.ts", import.meta.url)) },
  },
  test: {
    environment: "node",
    // TZ=UTC before the workers start, as in `pnpm test`; then the stack's settings and the test accounts' sessions.
    globalSetup: ["./vitest.global-setup.ts", "./tests/db/global-setup.ts"],
    setupFiles: ["./tests/db/setup.ts"],
    include: ["**/*.db.test.ts"],
    exclude: [...configDefaults.exclude, ".next/**", "tests/e2e/**", "docs/**", "vossie-audit/**"],
    fileParallelism: false,
    testTimeout: 30_000,
  },
});
