import { randomBytes } from "node:crypto";
import { defineConfig, devices } from "@playwright/test";
import { localStack } from "./tests/e2e-supabase/helpers/local";

// The end-to-end sign-in specs on Supabase (phase B, Task 11): `pnpm e2e:supabase`, against the local stack
// (`supabase start`), never the live project. Their own folder, so `pnpm e2e` (the sample backend) never runs them,
// and their own port, so they never meet another server.
//
// The server is built and started here with VOSSIE_BACKEND=supabase and the local stack's URL and keys, read from
// `supabase status` now and never written to a file, and a throwaway VOSSIE_AUTH_HMAC_KEY made for this run. The build
// uses .next in this checkout: never run it while another build in the same checkout runs.
//
// One worker: every sign-in comes from one address, and local Auth allows 30 codes and 30 code checks per 5 minutes per
// address, so the tests run one at a time, and the checks that don't depend on the screen's size (the wrong tries,
// the posts sent at once, the renewal, the idle sweep, two accounts in one browser) run at desktop-1440 only.

const PORT = 3303;
const baseURL = `http://localhost:${PORT}`;
const local = localStack();
// A throwaway CRON_SECRET for this run, as the HMAC key is (the MVP spec's flow 12 calls both crons with it). Playwright
// reads this file again in each worker: the first read keeps it in process.env, which the workers inherit, so the
// server and the tests hold the same one. It's never printed or written down.
const cronSecret = (process.env.VOSSIE_E2E_CRON_SECRET ??= randomBytes(32).toString("base64url"));

export default defineConfig({
  testDir: "./tests/e2e-supabase",
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [["list"]],
  timeout: 60_000,
  use: {
    baseURL,
    locale: "en-ZA",
    timezoneId: "Africa/Johannesburg",
    serviceWorkers: "block",
    trace: "retain-on-failure",
  },
  webServer: {
    command: `pnpm build && pnpm start --port ${PORT}`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 300_000,
    env: {
      VOSSIE_BACKEND: "supabase",
      SUPABASE_URL: local.API_URL,
      SUPABASE_PUBLISHABLE_KEY: local.PUBLISHABLE_KEY,
      SUPABASE_SECRET_KEY: local.SECRET_KEY,
      VOSSIE_EMAIL_DOMAINS: "vossie.net,eduvos.com,vossie.test",
      VOSSIE_AUTH_HMAC_KEY: randomBytes(32).toString("base64"),
      CRON_SECRET: cronSecret,
    },
  },
  projects: [
    {
      name: "phone-390",
      use: { ...devices["Desktop Chrome"], viewport: { width: 390, height: 844 }, screen: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
    },
    { name: "desktop-1440", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
  ],
});
