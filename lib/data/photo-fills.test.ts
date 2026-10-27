import { beforeEach, describe, expect, it } from "vitest";
import { reservePhotoFill } from "./photo-fills";
import { resetSampleStore, sampleStore } from "./store";

const NOW = new Date("2026-10-27T08:00:00.000Z");
const later = (ms: number) => new Date(NOW.getTime() + ms);
const HOUR = 60 * 60 * 1000;

beforeEach(() => resetSampleStore());

describe("reservePhotoFill (spec decision 12)", () => {
  it("allows up to the limit in any 24 hours, then refuses without counting", async () => {
    for (let i = 0; i < 3; i += 1) expect(await reservePhotoFill("acc-1", later(i), 3)).toBe(true);
    expect(await reservePhotoFill("acc-1", later(10), 3)).toBe(false);
    expect(sampleStore().photoFills.get("acc-1")).toHaveLength(3);
    expect(await reservePhotoFill("acc-2", later(10), 3)).toBe(true);
  });

  it("forgets presses more than 24 hours old", async () => {
    for (let i = 0; i < 3; i += 1) await reservePhotoFill("acc-1", later(i), 3);
    expect(await reservePhotoFill("acc-1", later(24 * HOUR + 1000), 3)).toBe(true);
    expect(sampleStore().photoFills.get("acc-1")).toHaveLength(1);
  });
});
