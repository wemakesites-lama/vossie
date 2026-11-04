// scripts/photo-test.hand.ts
// The photo test (AI features spec section 8), run by hand with real keys, never in CI:
//   VOSSIE_PHOTO_TEST=~/campuscart-photo-test pnpm vitest run --config vitest.hand.config.mts
// Each item in that folder ("calculator.jpg", or "calculator-1.jpg", "calculator-2.jpg" … with -1 the cover) is read by
// Groq (the cover only) and by Haiku at low and at medium effort. The results go to results.md in the same folder. An
// optional expected.json ({ "calculator": { "categorySlug": "tech", "moduleCode": null } }) adds a column to compare.
// A Tip column shows each run's photo tip (AI stage F); one the check dropped shows as "dropped: …". expected.json may
// give `tip` (a kind, or null for none).
// Keys come from .env.local. It costs a few cents. Photos of people need their consent.

import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { extname, join } from "node:path";
import { describe, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { categories } from "@/data/fixtures/categories";
import { listingRequest } from "@/lib/data/ai";
import { read as readHaiku } from "@/lib/data/ai/anthropic";
import { read as readGroq } from "@/lib/data/ai/groq";
import { checkSuggestion } from "@/lib/selling/suggest";
import type { PhotoType } from "@/lib/types";

const TYPES: Readonly<Record<string, PhotoType>> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};
/** Groq's free tier allows about 3 photo reads a minute (photo-to-listing spec section 13). */
const GROQ_PAUSE_MS = 20_000;

type Expected = Record<string, { categorySlug?: string; moduleCode?: string | null; tip?: string | null }>;

/** The folder's photos by item, in name order, so "-1" is each item's cover. */
function items(dir: string): Map<string, string[]> {
  const groups = new Map<string, string[]>();
  for (const file of readdirSync(dir).sort()) {
    if (!TYPES[extname(file).toLowerCase()]) continue;
    const item = file.replace(/(-\d+)?\.[^.]+$/, "");
    groups.set(item, [...(groups.get(item) ?? []), file]);
  }
  return groups;
}

/** A tip as a table cell, with any pipe made safe. */
const tipCell = (tip: { photo: number; kind: string; text: string } | null | undefined) =>
  tip ? `${tip.photo} ${tip.kind}: ${tip.text.replaceAll("|", "/")}` : "";

/** The tip the model gave, before the check: so a tip the check dropped still shows. */
function rawTip(text: string) {
  try {
    const tip = (JSON.parse(text) as { photoTip?: unknown }).photoTip;
    return tip && typeof tip === "object" ? (tip as { photo: number; kind: string; text: string }) : null;
  } catch {
    return null;
  }
}

describe("the photo test (by hand)", () => {
  it("reads every item with each provider and writes results.md", { timeout: 60 * 60_000 }, async () => {
    const dir = process.env.VOSSIE_PHOTO_TEST;
    if (!dir) throw new Error("Set VOSSIE_PHOTO_TEST to the folder of test photos.");
    if (existsSync(".env.local")) process.loadEnvFile(".env.local");
    const expectedFile = join(dir, "expected.json");
    const expected: Expected = existsSync(expectedFile) ? JSON.parse(readFileSync(expectedFile, "utf8")) : {};
    const slugs = categories.map((category) => category.slug);
    const runs = [
      { name: "groq", read: readGroq, effort: null },
      { name: "haiku low", read: readHaiku, effort: "low" },
      { name: "haiku medium", read: readHaiku, effort: "medium" },
    ] as const;
    const rows = [
      "| Item | Run | ms | Result | Title | Category | Condition | Module | Tip | Expected |",
      "|---|---|---|---|---|---|---|---|---|---|",
    ];
    for (const [item, files] of items(dir)) {
      const photos = files.map((file) => ({
        type: TYPES[extname(file).toLowerCase()],
        bytes: new Uint8Array(readFileSync(join(dir, file))),
      }));
      const request = listingRequest(photos, categories);
      for (const run of runs) {
        if (run.effort) process.env.VOSSIE_HAIKU_EFFORT = run.effort;
        const started = performance.now();
        const reply = await run.read(request);
        const ms = Math.round(performance.now() - started);
        // Groq reads only the cover (groq.ts), so its tip is checked against one photo, as the door does.
        const seen = run.name === "groq" ? 1 : request.images.length;
        const checked = reply.ok ? checkSuggestion(reply.text, slugs, seen) : reply.failure;
        const given = reply.ok ? rawTip(reply.text) : null;
        const tip =
          typeof checked === "string" ? "" : checked.photoTip ? tipCell(checked.photoTip) : given ? `dropped: ${tipCell(given)}` : "";
        const cells =
          typeof checked === "string"
            ? [checked, "", "", "", "", ""]
            : ["ok", checked.title, checked.categorySlug, checked.condition, checked.moduleCode ?? "", tip];
        const want = expected[item];
        const wanted = want
          ? `${want.categorySlug ?? ""} ${want.moduleCode ?? ""} ${want.tip === undefined ? "" : `tip ${want.tip ?? "none"}`}`.trim()
          : "";
        rows.push(`| ${item} | ${run.name} | ${ms} | ${cells.join(" | ")} | ${wanted} |`);
        if (run.name === "groq") await new Promise((resolve) => setTimeout(resolve, GROQ_PAUSE_MS));
      }
    }
    writeFileSync(join(dir, "results.md"), `${rows.join("\n")}\n`);
  });
});
