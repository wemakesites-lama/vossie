import { vi } from "vitest";

// Runs before every `pnpm test:db` file. vitest.setup.ts is jsdom-specific, so only its next/cache stand-in is copied:
// the data layer's "use cache" functions tag what they return, and cacheTag needs Next's runtime.
vi.mock("next/cache", () => ({
  cacheTag: vi.fn(),
  cacheLife: () => {},
  updateTag: () => {},
  revalidateTag: () => {},
  refresh: () => {},
}));
