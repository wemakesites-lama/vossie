// Runs once in Vitest's main process, before any test worker starts, so every worker is born in UTC.
// Unit tests run in UTC on every machine (staff tools plan amendment 12.3). This Mac's clock is SAST (UTC+2), and a test
// that quietly relied on it would pass here and fail in CI or on the host. The rule is "store UTC, render in
// Africa/Johannesburg, never rely on the server's timezone", so the tests should never be able to rely on it either.
// lib/time.test.ts checks that this took effect.
export default function setup() {
  process.env.TZ = "UTC";
}
