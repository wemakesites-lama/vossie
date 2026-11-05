import { describe, expect, it } from "vitest";
import { TOUR_IDS } from "./targets";
import { TOURS } from "./tours";

describe("the tours' words (guided tour spec 4)", () => {
  it("has a tour for every id", () => {
    expect(Object.keys(TOURS).sort()).toEqual([...TOUR_IDS].sort());
  });

  it.each(Object.entries(TOURS))("%s: steps are short and plain", (_, steps) => {
    expect(steps.length).toBeGreaterThanOrEqual(3);
    for (const step of steps) {
      expect(step.body.length, step.title).toBeLessThanOrEqual(140);
      expect(step.title.length, step.title).toBeLessThanOrEqual(30);
      expect(`${step.title} ${step.body}`, "no exclamation marks").not.toContain("!");
    }
  });

  it("names each part once per tour, so no step shows twice", () => {
    for (const steps of Object.values(TOURS)) {
      const names = steps.flatMap((step) => (typeof step.target === "string" ? [step.target] : [...step.target]));
      expect(new Set(names).size).toBe(names.length);
    }
  });
});
