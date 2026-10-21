import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sampleSellerRows } from "@/data/fixtures/shops";
import { countWaitingShops, getShopForReview, listMentors, listShopsForReview } from "@/lib/data/staff-shops";
import { dropContractAccounts, normalise, parity } from "@/tests/db/parity";
import { supabaseWorld } from "@/tests/db/supabase-world";
import { setViewer } from "@/tests/db/viewer";
import { staffShopsContract } from "./staff-shops.contract";

// The Hub's shop decisions on the local stack (C4/C5 plan Task 14): the staff functions with the admin's session, and
// the review read over shops, staff_seller_profiles, profiles and the catalog snapshot.
vi.mock("@/lib/data/supabase/clients", async (original) => (await import("@/tests/db/viewer")).withViewerSeam(await original()));

describe("the Hub's shop decisions on the local stack (C4/C5 plan Task 14)", () => {
  staffShopsContract(supabaseWorld);
});

describe("the Sellers list gives the sample store's answer on the seed (C4/C5 plan Task 14)", () => {
  beforeEach(() => {
    setViewer("staff");
  });
  afterEach(() => {
    setViewer(null);
  });
  const ownerless = <T extends { owner: { id: string } | null; mentor: { id: string } | null }>(list: T[]) =>
    dropContractAccounts(list, (review) => review.owner?.id ?? "");

  it("lists every shop in the same order and standing", async () => {
    const { sample, supabase } = await parity(() => listShopsForReview());
    expect(sample.length).toBeGreaterThan(5);
    expect(normalise(ownerless(supabase))).toEqual(normalise(ownerless(sample)));
  });

  it("reviews each seed shop the same, and counts the same waiting shops", async () => {
    for (const row of sampleSellerRows) {
      const { sample, supabase } = await parity(() => getShopForReview(row.slug));
      expect(normalise(supabase), row.slug).toEqual(normalise(sample));
    }
    const { sample, supabase } = await parity(() => countWaitingShops());
    expect(supabase).toBe(sample);
  });

  it("offers the same mentors", async () => {
    const { sample, supabase } = await parity(() => listMentors(null));
    expect(sample.length).toBeGreaterThan(0);
    expect(dropContractAccounts(normalise(supabase), (person) => person.id)).toEqual(normalise(sample));
  });
});
