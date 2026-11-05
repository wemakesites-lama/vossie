import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { isTourId, TOUR_IDS } from "./targets";
import { TOURS } from "./tours";

// Guided tour spec 9: every part a tour names is marked somewhere in the markup, and every marked page has a tour.

const ROOT = process.cwd();
const source = ["app", "components"]
  .flatMap((folder) =>
    (readdirSync(join(ROOT, folder), { recursive: true }) as string[])
      .filter((file) => /\.tsx?$/.test(file) && !/\.test\.tsx?$/.test(file))
      .map((file) => readFileSync(join(ROOT, folder, file), "utf8")),
  )
  .join("\n");

const targets = [
  ...new Set(
    Object.values(TOURS).flatMap((steps) =>
      steps.flatMap((step) => (typeof step.target === "string" ? [step.target] : [...step.target])),
    ),
  ),
];

describe("the tours' markup", () => {
  it.each(targets)("%s is marked in the markup", (target) => {
    // data-tour="…", a component's tour="…" prop, or a map's value (the tab bar's PILL_TOURS).
    expect(source).toMatch(new RegExp(`(?:data-tour=|tour=\\{?|[a-z]+: )"${target}"`));
  });

  it("marks a page only with a tour that exists", () => {
    const pages = [...source.matchAll(/data-tour-page="([^"]+)"/g)].map((match) => match[1]);
    expect(pages.filter((id) => !isTourId(id))).toEqual([]);
    expect(new Set(pages)).toEqual(new Set(TOUR_IDS));
  });
});
