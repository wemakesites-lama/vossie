import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import sitemap from "@/app/sitemap";
import { parity } from "@/tests/db/parity";

// The sitemap on the local stack (2b plan Task 20): every reader it calls is switched in C1 (listings, shops, open
// requests, the Hub's posts; collections are the code's), so on the seed it lists the sample store's addresses. It
// reads today after connection(), a stand-in here. Compared as sets: the ids come in each backend's own order.
vi.mock("next/server", () => ({ connection: async () => undefined }));

const SITE = "https://vossie.test";

describe("the sitemap gives the sample store's entries on the seed (2b plan Task 20)", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", SITE);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("lists the same addresses, each once", async () => {
    const { sample, supabase } = await parity(() => sitemap());
    const urls = (entries: typeof sample) => entries.map((entry) => entry.url);
    expect(urls(sample).length).toBeGreaterThan(100);
    expect(urls(sample).every((url) => url.startsWith(`${SITE}/`))).toBe(true);
    expect(new Set(urls(supabase))).toEqual(new Set(urls(sample)));
    expect(urls(supabase)).toHaveLength(urls(sample).length);
    expect(new Set(urls(supabase)).size).toBe(urls(supabase).length);
  });
});
