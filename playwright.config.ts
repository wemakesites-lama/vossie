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
    { name: "phone-360", use: phone(360, 780), testIgnore: SELLING_WRITES },
    { name: "phone-390", use: phone(390, 844), testIgnore: SELLING_WRITES },
    {
      name: "tablet-768",
      use: { ...desktop(768, 1024), screen: { width: 768, height: 1024 }, hasTouch: true },
      testIgnore: SELLING_WRITES,
    },
    { name: "laptop-1024", use: desktop(1024, 768), testIgnore: SELLING_WRITES },
    { name: "desktop-1440", use: desktop(1440, 900), testIgnore: SELLING_WRITES },
    // After the five above (selling plan decision 25). Run it alone with --project=selling-writes --no-deps.
    { name: "selling-writes", use: phone(390, 844), testMatch: SELLING_WRITES, dependencies: DEVICE_PROJECTS },
  ],
});
