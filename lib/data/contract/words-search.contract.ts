import { afterEach, beforeEach, expect, it } from "vitest";
import { reserveWordsSearch } from "@/lib/data/words-search";

// The words search's site-wide daily cap (AI stage E plan decision 5), the same in both backends: words-search.test.ts
// runs it on the sample store (`pnpm test`), words-search.db.test.ts on the local stack (`pnpm test:db`). On Supabase the
// day is the database's, so the contract keeps to one day. The count is site-wide, so each test starts from none.

export function wordsSearchContract(forgetParses: () => void | Promise<void>): void {
  beforeEach(async () => {
    await forgetParses();
  });
  afterEach(async () => {
    await forgetParses();
  });

  it("takes parses while under the cap, then none", async () => {
    const now = new Date();
    expect(await reserveWordsSearch(now, 2)).toBe(true);
    expect(await reserveWordsSearch(now, 2)).toBe(true);
    expect(await reserveWordsSearch(now, 2)).toBe(false);
  });

  it("takes nothing with a cap of 0", async () => {
    expect(await reserveWordsSearch(new Date(), 0)).toBe(false);
  });
}
