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
// The tests that post requests, offer, hide requests or publish listings run after every other test, so the board's,
// the homepage's and browse's counts never move under another test (community actions plan decision 27). Their checks
// (axe, layout shift and size on the pages that need a posted request or an offer) run with them.
const COMMUNITY_WRITES = /community-(writes|checks)\.spec\.ts$/;
// The saved-search tests that publish run after every other test: new listings change browse's counts, and Tech
// corner's would land in community-writes' follow test, which counts them (search alerts plan decision 19).
const ALERTS_WRITES = /alerts-writes\.spec\.ts$/;
// Stage J's tests that give and take away staff roles, hide and show listings and requests again, and read the admin's
// numbers, with their checks and screenshots, run after every other test, so a new staff role or a hidden listing never
// lands under another test (stage J plan decision 21).
const STAFF_ACCOUNTS = /staff-accounts-(writes|checks|screenshots)\.spec\.ts$/;
// Stage K's message-limit test starts 40 conversations as a fresh account, which the sample shops' inboxes then show,
// so it runs after every other test (stage K plan decision 22).
const HARDENING_WRITES = /hardening-writes\.spec\.ts$/;
// Stage L's tests give the sample seller the Admin role for their length, and post requests as a fresh account, so
// they run after every other test (stage L plan decision 26).
const HOUSEKEEPING_WRITES = /housekeeping-writes\.spec\.ts$/;
// Role views' writes (a new shop approved, a buyer's first message, a listing marked sold from its thread) run after
// every other test, so no count another test reads moves under them (role views spec 9; N2 plan, Task 14).
const ROLE_VIEWS_WRITES = /role-views-writes\.spec\.ts$/;
// Every write project's files: the device projects leave them all out.
const WRITES = [
  SELLING_WRITES,
  STAFF_WRITES,
  COMMUNITY_WRITES,
  ALERTS_WRITES,
  STAFF_ACCOUNTS,
  HARDENING_WRITES,
  HOUSEKEEPING_WRITES,
  ROLE_VIEWS_WRITES,
];

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
    { name: "phone-360", use: phone(360, 780), testIgnore: WRITES },
    { name: "phone-390", use: phone(390, 844), testIgnore: WRITES },
    {
      name: "tablet-768",
      use: { ...desktop(768, 1024), screen: { width: 768, height: 1024 }, hasTouch: true },
      testIgnore: WRITES,
    },
    { name: "laptop-1024", use: desktop(1024, 768), testIgnore: WRITES },
    { name: "desktop-1440", use: desktop(1440, 900), testIgnore: WRITES },
    // After the five above (selling plan decision 25). Run it alone with --project=selling-writes --no-deps.
    { name: "selling-writes", use: phone(390, 844), testMatch: SELLING_WRITES, dependencies: DEVICE_PROJECTS },
    // After everything else (staff tools plan decision 21). Run it alone with --project=staff-writes --no-deps.
    {
      name: "staff-writes",
      use: desktop(1440, 900),
      testMatch: STAFF_WRITES,
      dependencies: [...DEVICE_PROJECTS, "selling-writes"],
    },
    // After everything else (community actions plan decision 27). Run it alone with --project=community-writes --no-deps.
    {
      name: "community-writes",
      use: phone(390, 844),
      testMatch: COMMUNITY_WRITES,
      dependencies: [...DEVICE_PROJECTS, "selling-writes", "staff-writes"],
    },
    // After everything else (search alerts plan decision 19). Run it alone with --project=alerts-writes --no-deps.
    {
      name: "alerts-writes",
      use: phone(390, 844),
      testMatch: ALERTS_WRITES,
      dependencies: [...DEVICE_PROJECTS, "selling-writes", "staff-writes", "community-writes"],
    },
    // After everything else (stage J plan decision 21). Run it alone with --project=staff-accounts-writes --no-deps.
    {
      name: "staff-accounts-writes",
      use: desktop(1440, 900),
      testMatch: STAFF_ACCOUNTS,
      dependencies: [...DEVICE_PROJECTS, "selling-writes", "staff-writes", "community-writes", "alerts-writes"],
    },
    // After everything else (stage K plan decision 22). Run it alone with --project=hardening-writes --no-deps.
    {
      name: "hardening-writes",
      use: desktop(1440, 900),
      testMatch: HARDENING_WRITES,
      dependencies: [...DEVICE_PROJECTS, "selling-writes", "staff-writes", "community-writes", "alerts-writes", "staff-accounts-writes"],
    },
    // After everything else (stage L plan decision 26). Run it alone with --project=housekeeping-writes --no-deps.
    {
      name: "housekeeping-writes",
      use: desktop(1440, 900),
      testMatch: HOUSEKEEPING_WRITES,
      dependencies: [
        ...DEVICE_PROJECTS,
        "selling-writes",
        "staff-writes",
        "community-writes",
        "alerts-writes",
        "staff-accounts-writes",
        "hardening-writes",
      ],
    },
    // After everything else (role views spec 9). Run it alone with --project=role-views-writes --no-deps.
    {
      name: "role-views-writes",
      use: phone(390, 844),
      testMatch: ROLE_VIEWS_WRITES,
      dependencies: [
        ...DEVICE_PROJECTS,
        "selling-writes",
        "staff-writes",
        "community-writes",
        "alerts-writes",
        "staff-accounts-writes",
        "hardening-writes",
        "housekeeping-writes",
      ],
    },
  ],
});
