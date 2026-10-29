import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Dark and Night themes spec 4.2: every pairing a page uses passes WCAG 2.2 AA in every theme, read from the tokens
// in app/globals.css (text 4.5:1, large text, borders and marks 3:1).

const css = readFileSync(join(process.cwd(), "app", "globals.css"), "utf8");

/** `--color-name: #hex;` declarations in a block of CSS. */
function tokensIn(block: string): Record<string, string> {
  return Object.fromEntries([...block.matchAll(/--color-([a-z-]+):\s*(#[0-9a-f]{6})\b/gi)].map((m) => [m[1], m[2]]));
}

/** The body of the first `@variant <name> { … }` inside a top-level `:root { … }`. */
function variantBlock(name: string): string {
  const start = css.search(new RegExp(`^:root \\{\\n  @variant ${name} \\{`, "m"));
  if (start < 0) throw new Error(`no :root block for ${name}`);
  const end = css.indexOf("\n  }\n}", start);
  return css.slice(start, end);
}

const light = tokensIn(css.slice(css.indexOf("@theme {"), css.indexOf("}", css.indexOf("@theme {"))));
const themes: Record<string, Record<string, string>> = {
  light,
  dark: { ...light, ...tokensIn(variantBlock("dark")) },
  // Night's variant matches after Dark's, so it starts from Dark's tokens.
  night: { ...light, ...tokensIn(variantBlock("dark")), ...tokensIn(variantBlock("night")) },
};

function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  return [n >> 16, (n >> 8) & 255, n & 255]
    .map((c) => c / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
    .reduce((sum, c, i) => sum + c * [0.2126, 0.7152, 0.0722][i], 0);
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const SURFACES = ["white", "panel", "pale"];
/** [foreground, backgrounds, ratio]. */
const PAIRS: [string, string[], number][] = [
  ["navy", SURFACES, 4.5],
  ["ink", SURFACES, 4.5],
  ["muted", SURFACES, 4.5],
  // Links on white (CLAUDE.md's brand rules): on grey and pale panels Light uses navy instead (SectionHeader's tone).
  ["sky-dark", ["white"], 4.5],
  ["danger", ["white", "panel", "danger-tint"], 4.5],
  ["success", ["white", "panel", "success-tint"], 4.5],
  ["warning", ["white", "panel", "warning-tint"], 4.5],
  ["field", ["white", "panel"], 3],
  ["idle-text", ["white", "panel"], 3],
  ["on-band", ["band"], 4.5],
  ["on-action", ["action"], 4.5],
  ["on-sky", ["sky"], 4.5],
  ["on-band", ["alert"], 4.5],
];

describe.each(Object.keys(themes))("the %s theme's colours", (theme) => {
  const t = themes[theme];

  it.each(PAIRS)("%s passes on %j at %s:1", (fg, backgrounds, ratio) => {
    for (const bg of backgrounds) {
      expect(t[fg] && t[bg], `${fg} and ${bg} are tokens`).toBeTruthy();
      expect(contrast(t[fg], t[bg]), `${fg} on ${bg}`).toBeGreaterThanOrEqual(ratio);
    }
  });

  it("an action stands apart from the page (3:1, WCAG 1.4.11)", () => {
    expect(contrast(t.action, t.white)).toBeGreaterThanOrEqual(3);
  });
});

it("reads each theme's own block, so a theme can't silently fall back to another", () => {
  expect(new Set(Object.values(themes).map((t) => t.white)).size).toBe(Object.keys(themes).length);
});
