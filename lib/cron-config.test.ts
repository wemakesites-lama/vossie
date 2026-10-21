import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// vercel.json's cron jobs (C2/C3 plan decision 15): one, the photo sweep, at a route that exists, at most once a day
// (a Hobby team runs a job at most daily; the controller's answer to open question 2: daily on any plan).

type Cron = { path: string; schedule: string };
const config = JSON.parse(readFileSync("vercel.json", "utf8")) as { crons?: Cron[] };

/** Whether a cron field is a single number in range (no lists, ranges or steps). */
const single = (field: string, max: number) => /^\d+$/.test(field) && Number(field) <= max;

describe("vercel.json's cron jobs (C2/C3 plan decision 15)", () => {
  it("has one job, the photo sweep, at a route file under app/", () => {
    expect(config.crons).toHaveLength(1);
    const [job] = config.crons!;
    expect(job.path).toBe("/api/cron/photos");
    expect(existsSync(join("app", job.path, "route.ts"))).toBe(true);
  });

  it("runs it at a fixed minute and hour of every day: at most once a day", () => {
    const fields = config.crons![0].schedule.split(" ");
    expect(fields).toHaveLength(5);
    const [minute, hour, day, month, weekday] = fields;
    expect(single(minute, 59)).toBe(true);
    expect(single(hour, 23)).toBe(true);
    expect([day, month, weekday]).toEqual(["*", "*", "*"]);
    // 03:20 UTC is 05:20 SAST.
    expect(config.crons![0].schedule).toBe("20 3 * * *");
  });
});
