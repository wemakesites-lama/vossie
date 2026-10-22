import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { dailyEnquiries, recentCounts } from "@/lib/data/shop-stats";
import { resetSampleStore, sampleStore } from "@/lib/data/store";
import { testAdminClient } from "@/tests/db/accounts";
import { parity } from "@/tests/db/parity";
import { type SupabaseWorld, supabaseWorld } from "@/tests/db/supabase-world";
import { sellerHomeContract } from "./seller-home.contract";

// The queue and the follower counts read as the shop's owner, through the viewer seam (stats.db.test.ts's pattern).
vi.mock("@/lib/data/supabase/clients", async (original) => (await import("@/tests/db/viewer")).withViewerSeam(await original()));

// The seed's one sale as the seed has it (stats.db.test.ts, lines 12 to 42): the hourly settle-sales job may have
// confirmed it already, so it's put back to done before each test and confirmed again after.
const admin = testAdminClient();
let confirmedByTheJob: { id: string; confirmed_at: string | null }[] = [];

beforeEach(async () => {
  const { data, error } = await admin.from("conversations").select("id, confirmed_at").eq("status", "confirmed").eq("confirmed_by", "auto");
  if (error) throw new Error(error.message);
  confirmedByTheJob = data;
  for (const { id } of data) {
    const undone = await admin.from("conversations").update({ status: "done", confirmed_at: null, confirmed_by: null }).eq("id", id);
    if (undone.error) throw new Error(undone.error.message);
  }
});

afterEach(async () => {
  for (const { id, confirmed_at } of confirmedByTheJob) {
    const redone = await admin.from("conversations").update({ status: "confirmed", confirmed_at, confirmed_by: "auto" }).eq("id", id);
    if (redone.error) throw new Error(redone.error.message);
  }
  confirmedByTheJob = [];
});

describe("the seller home's readers on the local stack (role views N2)", () => {
  sellerHomeContract(supabaseWorld);
});

describe("the seller home's readers give the sample store's answers on the seed (role views N2)", () => {
  let world: SupabaseWorld;
  const times = [new Date(), new Date("2026-10-14T10:00:00.000Z"), new Date("2026-10-21T10:00:00.000Z")];
  beforeEach(() => {
    world = supabaseWorld();
  });
  afterEach(async () => {
    await world.cleanup();
  });

  it("the week and the week before, and enquiries by day, for every shop that has talked to a buyer", async () => {
    resetSampleStore();
    const slugs = [...new Set([...sampleStore().conversations.values()].map((row) => row.sellerSlug)), "hair-studio"];
    for (const now of times) {
      for (const slug of slugs) {
        const recent = await parity(() => recentCounts(slug, 7, now));
        expect(recent.supabase, slug).toEqual(recent.sample);
        const daily = await parity(() => dailyEnquiries(slug, 14, now));
        expect(daily.supabase, slug).toEqual(daily.sample);
      }
    }
  });
});
