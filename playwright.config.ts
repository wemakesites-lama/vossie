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

// The tests that publish, change or delete listings run after every other test (selling plan decision 25), so the
// counts other tests check (36 listings in browse, "2 listings" on Tech corner's storefront) never move under them.
const SELLING_WRITES = /selling-writes\.spec\.ts$/;
const DEVICE_PROJECTS = ["phone-360", "phone-390", "tablet-768", "laptop-1024", "desktop-1440"];
// The staff actions buyers can see (Verified, hidden listings, pins, Hub posts) run after every other test, selling's
// writes included, so nothing another test counts moves under it (staff tools plan decision 21).
const STAFF_WRITES = /staff-writes\.spec\.ts$/;

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
    // Production builds register Vossie's service worker (community actions spec 2.22). Only tests/e2e/offline.spec.ts
    // lets it run; everywhere else a worker would keep the offline page and change what a dropped request shows.
    // This reaches the built-in `context` and `page` fixtures only: every browser.newContext(…) says it itself
    // (community actions plan amendment 4).
    serviceWorkers: "block",
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
    { name: "phone-360", use: phone(360, 780), testIgnore: [SELLING_WRITES, STAFF_WRITES] },
    { name: "phone-390", use: phone(390, 844), testIgnore: [SELLING_WRITES, STAFF_WRITES] },
    {
      name: "tablet-768",
      use: { ...desktop(768, 1024), screen: { width: 768, height: 1024 }, hasTouch: true },
      testIgnore: [SELLING_WRITES, STAFF_WRITES],
    },
    { name: "laptop-1024", use: desktop(1024, 768), testIgnore: [SELLING_WRITES, STAFF_WRITES] },
    { name: "desktop-1440", use: desktop(1440, 900), testIgnore: [SELLING_WRITES, STAFF_WRITES] },
    // After the five above (selling plan decision 25). Run it alone with --project=selling-writes --no-deps.
    { name: "selling-writes", use: phone(390, 844), testMatch: SELLING_WRITES, dependencies: DEVICE_PROJECTS },
    // After everything else (staff tools plan decision 21). Run it alone with --project=staff-writes --no-deps.
    {
      name: "staff-writes",
      use: desktop(1440, 900),
      testMatch: STAFF_WRITES,
      dependencies: [...DEVICE_PROJECTS, "selling-writes"],
    },
  ],
});
