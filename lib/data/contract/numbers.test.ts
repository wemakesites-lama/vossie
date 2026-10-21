import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { sampleWorld } from "@/tests/contract/sample-world";
import { numbersContract } from "./numbers.contract";

describe("the admin's numbers on the sample store (C4/C5 plan Task 21)", () => {
  numbersContract(sampleWorld);
});

/** Every .ts and .tsx file under these folders, tests and contracts left out. */
function sources(...folders: string[]): string[] {
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) walk(path);
      else if (/\.tsx?$/.test(name) && !/\.(test|contract)\.tsx?$/.test(name)) files.push(path);
    }
  };
  folders.forEach(walk);
  return files;
}

describe("the admin's numbers reach a page only through protectCounts (C4/C5 plan Task 21; CLAUDE.md)", () => {
  it("calls admin_weekly_counts only from lib/data/supabase/numbers.ts", () => {
    const callers = sources("app", "lib", "components").filter((path) => /rpc\(\s*["']admin_weekly_counts["']/.test(readFileSync(path, "utf8")));
    expect(callers).toEqual(["lib/data/supabase/numbers.ts"]);
  });

  it("reads countByWeek only on the numbers page, whose raw counts go nowhere but protectCounts", () => {
    const callers = sources("app", "lib", "components").filter((path) => /\bcountByWeek\(/.test(readFileSync(path, "utf8")));
    expect(callers.sort()).toEqual(["app/admin/numbers/page.tsx", "lib/data/numbers.ts"]);
    const page = readFileSync("app/admin/numbers/page.tsx", "utf8");
    const uses = [...page.matchAll(/\braw\b/g)].map((match) => page.slice(Math.max(0, match.index - 20), match.index + 40));
    expect(uses).toHaveLength(2);
    expect(uses[0]).toContain("{ weeks, raw } = await countByWeek(");
    expect(uses[1]).toContain("protectCounts(raw,");
  });
});
