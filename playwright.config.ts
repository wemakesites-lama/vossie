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
    { name: "phone-360", use: phone(360, 780) },
    { name: "phone-390", use: phone(390, 844) },
    { name: "tablet-768", use: { ...desktop(768, 1024), screen: { width: 768, height: 1024 }, hasTouch: true } },
    { name: "laptop-1024", use: desktop(1024, 768) },
    { name: "desktop-1440", use: desktop(1440, 900) },
  ],
});
