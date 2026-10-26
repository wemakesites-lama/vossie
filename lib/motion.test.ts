import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { BACK, CARD, FORWARD, TAB } from "./motion";

const ROOT = resolve(__dirname, "..");

/** Every .tsx file under a folder, tests left out. */
function sources(folder: string): string[] {
  return readdirSync(join(ROOT, folder)).flatMap((name) => {
    const path = join(folder, name);
    if (statSync(join(ROOT, path)).isDirectory()) return sources(path);
    return path.endsWith(".tsx") && !path.includes(".test.") ? [path] : [];
  });
}

const read = (path: string) => readFileSync(join(ROOT, path), "utf8");
const code = [...sources("app"), ...sources("components")];
// A comment line: "//", "/*", "*" or "{/*" at its start.
const notComment = (line: string) => !/^\s*(\/\/|\/\*|\*|\{\/\*)/.test(line);

describe("calm navigation's link types (spec 4, layer 3)", () => {
  it("names each type once, and every type and reveal has its animation in globals.css", () => {
    const css = read("app/globals.css");
    for (const type of [...TAB, ...FORWARD, ...BACK, ...CARD, "reveal-in", "reveal-out"]) {
      expect(css, type).toMatch(new RegExp(`::view-transition-(new|old)\\(\\.${type}\\)`));
    }
  });

  it("wraps every page in PageTransition", () => {
    const pages = sources("app").filter((path) => path.endsWith("page.tsx"));
    expect(pages.length).toBeGreaterThan(50);
    const missing = pages.filter((path) => !read(path).includes("<PageTransition"));
    expect(missing).toEqual([]);
  });

  it("gives every \"Back to\" link the BACK type", () => {
    const backLinks = code.filter((path) => read(path).split("\n").some((line) => notComment(line) && line.includes("Back to")));
    expect(backLinks.length).toBeGreaterThan(10);
    const untyped = backLinks.filter((path) => !/transitionTypes=\{BACK\}/.test(read(path)));
    expect(untyped).toEqual([]);
  });

  it("lets every typed plain <Link> breathe the header crest while it waits (NavPending; NavLink has its own)", () => {
    const typedLinks = code.filter((path) => /<Link\b[^>]*?transitionTypes=/.test(read(path)));
    expect(typedLinks.length).toBeGreaterThan(20);
    const silent = typedLinks.filter((path) => !read(path).includes("<NavPending />"));
    expect(silent).toEqual([]);
  });

  it("takes types only from lib/motion.ts, never a literal array", () => {
    const literal = code.filter((path) => read(path).includes('transitionTypes={["'));
    expect(literal.map((path) => relative(ROOT, join(ROOT, path)))).toEqual([]);
  });
});
