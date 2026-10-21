import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { cronAllowed, CRON_SECRET_MIN } from "./cron";

// Vercel Cron's bearer (C2/C3 plan decision 15): a call is allowed only with exactly "Bearer <CRON_SECRET>", and only
// when the secret is long enough to be one. The secret here is made up in the test.

const SECRET = "s".repeat(40);

describe("cronAllowed (C2/C3 plan decision 15)", () => {
  it("allows exactly Bearer and the secret", () => {
    expect(cronAllowed(`Bearer ${SECRET}`, SECRET)).toBe(true);
  });

  it("refuses anything else, without throwing on unequal lengths", () => {
    for (const header of [
      null,
      "",
      `Bearer ${SECRET}x`,
      `Bearer ${SECRET.slice(1)}`,
      `bearer ${SECRET}`,
      `Basic ${SECRET}`,
      `Bearer  ${SECRET}`,
      ` Bearer ${SECRET}`,
      `Bearer ${SECRET} `,
      SECRET,
      `Bearer ${"t".repeat(40)}`,
    ]) {
      expect(cronAllowed(header, SECRET), String(header)).toBe(false);
    }
  });

  it("refuses every call while the secret is unset, blank or under 32 characters, even one that matches", () => {
    expect(CRON_SECRET_MIN).toBe(32);
    expect(cronAllowed("Bearer ", undefined)).toBe(false);
    expect(cronAllowed("Bearer undefined", undefined)).toBe(false);
    expect(cronAllowed("Bearer ", "")).toBe(false);
    const short = "s".repeat(31);
    expect(cronAllowed(`Bearer ${short}`, short)).toBe(false);
    const enough = "s".repeat(32);
    expect(cronAllowed(`Bearer ${enough}`, enough)).toBe(true);
  });

  it("compares in constant time and imports only node:crypto", () => {
    const source = readFileSync("lib/cron.ts", "utf8");
    expect(source).toContain("timingSafeEqual");
    expect([...source.matchAll(/from\s+["']([^"']+)["']/g)].map((match) => match[1])).toEqual(["node:crypto"]);
  });
});
