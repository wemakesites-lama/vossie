// scripts/looking-match.hand.ts
// "Someone's looking for this" with the real key (AI round two spec 8; AI stage G plan Task 10), run by hand, never in CI:
//   VOSSIE_LOOKING_TEST=~/campuscart-looking-test pnpm vitest run --config vitest.hand.config.mts scripts/looking-match.hand.ts
// Each of the 16 sample requests is read by Haiku exactly as a posted request would be (requestWords, the words
// search's request and check), and its stored search is matched against the sample listings at its campus. The results
// go to results.md in that folder. Keys come from .env.local; it costs well under a cent.

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { campuses } from "@/data/fixtures/campuses";
import { categories } from "@/data/fixtures/categories";
import { listings } from "@/data/fixtures/listings";
import { requests } from "@/data/fixtures/requests";
import { sellers } from "@/data/fixtures/sellers";
import { listingMatches } from "@/lib/browse/results";
import { checkWords } from "@/lib/browse/words";
import { wordsRequest } from "@/lib/data/ai";
import { read as readHaiku } from "@/lib/data/ai/anthropic";
import { requestMatchQuery, requestWords } from "@/lib/looking-for/match";

describe("the looking match with real Haiku (by hand)", () => {
  it("reads every sample request, checks the reply and matches it", { timeout: 10 * 60_000 }, async () => {
    process.loadEnvFile(".env.local");
    const dir = process.env.VOSSIE_LOOKING_TEST;
    if (!dir) throw new Error("Set VOSSIE_LOOKING_TEST to a folder for results.md");
    mkdirSync(dir, { recursive: true });
    const names = {
      sellers: new Map(sellers.map((seller) => [seller.slug, seller.name])),
      categories: new Map(categories.map((category) => [category.slug, category.name])),
    };
    const slugs = { categories: categories.map((c) => c.slug), campuses: campuses.map((c) => c.slug) };
    const rows: string[] = ["| Request | Words sent | q | ms | Matches at its campus |", "|---|---|---|---|---|"];
    let bad = 0;
    for (const request of requests) {
      const words = requestWords(request);
      const started = Date.now();
      const reply = await readHaiku(wordsRequest(words, categories, campuses));
      const ms = Date.now() - started;
      const parsed = reply.ok ? checkWords(reply.text, slugs) : null;
      if (!parsed) bad += 1;
      const query = parsed ? requestMatchQuery(parsed, request) : null;
      const found = query ? listings.filter((listing) => listingMatches(listing, query, names) !== null) : [];
      rows.push(
        `| ${request.title} | ${words.length} chars | ${query?.q ?? (reply.ok ? "(no item words)" : reply.failure)} | ${ms} | ${found.map((l) => l.title).join("; ") || "none"} |`,
      );
    }
    writeFileSync(join(dir, "results.md"), `${rows.join("\n")}\n`);
    // Every reply must pass the schema check: one that doesn't is the stage E kind of bug.
    expect(bad).toBe(0);
  });
});
