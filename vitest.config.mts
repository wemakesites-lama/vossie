import react from "@vitejs/plugin-react";
import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: "jsdom",
    // Sets TZ=UTC before the workers start (amendment 12.3 of the staff tools plan).
    globalSetup: ["./vitest.global-setup.ts"],
    setupFiles: ["./vitest.setup.ts"],
    include: ["**/*.test.{ts,tsx}"],
    // The *.db.test.ts files run against the local Supabase stack, in `pnpm test:db` (vitest.db.config.mts).
    exclude: [...configDefaults.exclude, ".next/**", "tests/e2e/**", "docs/**", "vossie-audit/**", "**/*.db.test.ts"],
  },
});
