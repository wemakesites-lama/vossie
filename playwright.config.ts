import { defineConfig, devices } from "@playwright/test";

const PORT = 3200;
const baseURL = `http://localhost:${PORT}`;

// Device setup per project:
// - Phones: mobile emulation, touch and 2x pixels.
// - Tablet: touch only.
// - Laptop and desktop: mouse.
// Every project sends the Desktop Chrome user agent, so user-agent checks (such as the iPhone
// install help) are covered by unit tests rather than here.
const phone = (width: number, height: number) => ({
  ...devices["Desktop Chrome"],
  viewport: { width, height },
  screen: { width, height },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
});

const desktop = (width: number, height: number) => ({
  ...devices["Desktop Chrome"],
  viewport: { width, height },
});

// The tests that publish, change or delete listings (selling-writes) run after every other test (selling plan
// decision 25), so the counts other tests check (36 listings in browse, "2 listings" on Tech corner's storefront) never
// move under them. Each deletes its own listing afterwards, passed or failed, so the counts are back to the sample
// ones for the next run on a reused server (E2E_REUSE_SERVER=1) or a retry.
//
// The order comes from a teardown, not from dependencies: every device project depends on `setup`, and `setup`'s
// teardown is selling-writes, which Playwright starts once every project depending on `setup` has finished. A project
// with dependencies is skipped when one of them has a failure, but a teardown has none, so selling-writes still runs
// when a device test fails.
//
// The cost: Playwright runs a dependency or a teardown in full whatever the filter. `pnpm e2e tests/e2e/browse.spec.ts`
// (or a -g, or --project=phone-390) runs `setup`, the filtered tests, then all of selling-writes. Add --no-deps to run
// only what the filter names (`pnpm e2e tests/e2e/browse.spec.ts --no-deps`), but never --no-deps with no filter:
// selling-writes would then run alongside the device projects. Run selling-writes alone with
// `pnpm e2e tests/e2e/selling-writes.spec.ts` (or --project=selling-writes): with no dependencies of its own, it runs
// by itself, and --repeat-each repeats it there (in a whole run, a teardown runs once).
const SELLING_WRITES = /selling-writes\.spec\.ts$/;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [["list"]],
  use: {
    baseURL,
    locale: "en-ZA",
    timezoneId: "Africa/Johannesburg",
    trace: "retain-on-failure",
  },
  webServer: {
    command: `pnpm build && pnpm start --port ${PORT}`,
    url: baseURL,
    // Always build and start a fresh server, so tests never run against stale code.
    // E2E_REUSE_SERVER=1 reuses a server you started yourself on port 3200.
    reuseExistingServer: process.env.E2E_REUSE_SERVER === "1",
    timeout: 240_000,
  },
  projects: [
    // First: checks the server answers. Its teardown, selling-writes, runs after the five device projects.
    { name: "setup", testMatch: /server\.setup\.ts$/, teardown: "selling-writes" },
    { name: "phone-360", use: phone(360, 780), testIgnore: SELLING_WRITES, dependencies: ["setup"] },
    { name: "phone-390", use: phone(390, 844), testIgnore: SELLING_WRITES, dependencies: ["setup"] },
    {
      name: "tablet-768",
      use: { ...desktop(768, 1024), screen: { width: 768, height: 1024 }, hasTouch: true },
      testIgnore: SELLING_WRITES,
      dependencies: ["setup"],
    },
    { name: "laptop-1024", use: desktop(1024, 768), testIgnore: SELLING_WRITES, dependencies: ["setup"] },
    { name: "desktop-1440", use: desktop(1440, 900), testIgnore: SELLING_WRITES, dependencies: ["setup"] },
    // Last, as `setup`'s teardown (see above). No dependencies: a teardown can't have any.
    { name: "selling-writes", use: phone(390, 844), testMatch: SELLING_WRITES },
  ],
});
