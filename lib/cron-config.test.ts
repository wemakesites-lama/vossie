import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// vercel.json's cron jobs (C2/C3 plan decision 15; C4 review fix 6): two, the photo sweep and the nightly badges, each
// at a route that exists, at most once a day (a Hobby team runs a job at most daily; the controller's answer to open
// question 2: daily on any plan).

type Cron = { path: string; schedule: string };
const config = JSON.parse(readFileSync("vercel.json", "utf8")) as { crons?: Cron[] };

/** Whether a cron field is a single number in range (no lists, ranges or steps). */
const single = (field: string, max: number) => /^\d+$/.test(field) && Number(field) <= max;

describe("vercel.json's cron jobs (C2/C3 plan decision 15; C4 review fix 6)", () => {
  it("has two jobs, the photo sweep and the badges, each at a route file under app/", () => {
    expect(config.crons!.map((job) => job.path)).toEqual(["/api/cron/photos", "/api/cron/badges"]);
    for (const job of config.crons!) expect(existsSync(join("app", job.path, "route.ts")), job.path).toBe(true);
  });

  it("runs each at a fixed minute and hour of every day: at most once a day", () => {
    for (const job of config.crons!) {
      const fields = job.schedule.split(" ");
      expect(fields, job.path).toHaveLength(5);
      const [minute, hour, day, month, weekday] = fields;
      expect(single(minute, 59), job.path).toBe(true);
      expect(single(hour, 23), job.path).toBe(true);
      expect([day, month, weekday], job.path).toEqual(["*", "*", "*"]);
    }
    // 03:20 UTC is 05:20 SAST; 22:05 UTC is 00:05 SAST, just after the day a badge's account age counts in turns.
    expect(config.crons!.map((job) => job.schedule)).toEqual(["20 3 * * *", "5 22 * * *"]);
  });
});
