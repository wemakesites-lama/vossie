import { defineConfig } from "vitest/config";

// Checks run by hand with real keys (AI features spec section 8): never in `pnpm test` or CI. Node, not jsdom, because
// the Anthropic SDK refuses to run in a browser-like environment.
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: { environment: "node", include: ["scripts/**/*.hand.ts"] },
});
