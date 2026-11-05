import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { onSupabase } from "@/lib/backend";
import { readOwnCoachWeeks, saveCoachWeek, tickCoachAction } from "@/lib/data/coach";
import { getShopOf } from "@/lib/data/shops";
import { resetSampleStore, sampleStore } from "@/lib/data/store";
import { sampleWorld } from "@/tests/contract/sample-world";
import { readThisWeek } from "./this-week";
import type { CoachAction } from "./types";
import { coachWeekOf, previousWeek } from "./week";

vi.mock("@/lib/backend", () => ({ onSupabase: vi.fn(() => false) }));
// The stored weeks pass through to the sample store; the Supabase case stands in for the read and watches the save.
vi.mock("@/lib/data/coach", async (original) => {
  const real = await original<typeof import("@/lib/data/coach")>();
  return { ...real, readOwnCoachWeeks: vi.fn(real.readOwnCoachWeeks), saveCoachWeek: vi.fn(real.saveCoachWeek) };
});
// The queue and the stored weeks are read through the sample store, so only the backend switch is mocked: with it on,
// the readers are stood in for, to check that nothing is made.
vi.mock("@/lib/selling/queue", () => ({
  queueFor: vi.fn(async () => ({ replies: { count: 0, oldest: null }, sales: [], listings: { available: 0, paused: 0, sold: 0, drafts: 0 } })),
}));

// Monday 2026-11-09 10:00 SAST, after the lazy hour even on Supabase.
const NOW = new Date("2026-11-09T08:00:00.000Z");
const WEEK = coachWeekOf(NOW);
const world = sampleWorld();

async function seller() {
  const id = await world.signedIn("seller");
  const slug = await world.openShop("seller");
  const own = await getShopOf(id);
  if (!own) throw new Error("no shop");
  return { id, slug, own };
}

const tipAction = (): CoachAction => ({
  id: "read-tip:t-old",
  kind: "read-tip",
  target: { type: "post", id: "t-old" },
  name: "Old tip",
  evidence: {},
  href: "/hub/t-old",
  title: "Read: Old tip",
  why: "A short tip.",
  asOf: "2026-11-02T08:00:00.000Z",
});

beforeEach(() => {
  resetSampleStore();
  vi.stubEnv("VOSSIE_AI_SHOP_COACH", "1");
  vi.stubEnv("VOSSIE_AI_PROVIDERS", "fake");
  vi.mocked(onSupabase).mockReturnValue(false);
});
afterEach(() => {
  vi.unstubAllEnvs();
});

describe("readThisWeek (AI stage I1, Task 7)", () => {
  it("makes the week once, in fixed wording", async () => {
    const { id, own } = await seller();
    const view = await readThisWeek({ id }, own, NOW);
    expect(view?.week).toBe(WEEK);
    expect(sampleStore().coachWeeks.size).toBe(1);
    expect([...sampleStore().coachWeeks.values()][0].writtenBy).toBe("fixed");
    expect(view?.items.length).toBeLessThanOrEqual(3);
    await readThisWeek({ id }, own, NOW);
    expect(sampleStore().coachWeeks.size).toBe(1);
  });

  it("settles last week when it makes this one, and says how it went", async () => {
    const { id, slug, own } = await seller();
    const tip = [...sampleStore().hubPosts.values()].find((p) => p.kind === "tip" && p.published);
    if (!tip) throw new Error("no published tip in the fixtures");
    await saveCoachWeek(
      slug,
      { week: previousWeek(WEEK), actions: [tipAction(), { ...tipAction(), id: `read-tip:${tip.id}`, target: { type: "post", id: tip.id } }], writtenBy: "fixed", mentorQuestions: null },
      new Date("2026-11-02T08:00:00.000Z"),
    );
    await tickCoachAction(id, slug, "read-tip:t-old", new Date("2026-11-03T08:00:00.000Z"));
    const view = await readThisWeek({ id }, own, NOW);
    const last = sampleStore().coachWeeks.get(`${id}:${previousWeek(WEEK)}`);
    expect(last?.settledAt).not.toBeNull();
    expect(last?.doneIds).toEqual(["read-tip:t-old"]);
    expect(view?.lastWeek).toContain("1 of 2");
  });

  it("shows nothing with the switch off", async () => {
    vi.stubEnv("VOSSIE_AI_SHOP_COACH", "0");
    const { id, own } = await seller();
    expect(await readThisWeek({ id }, own, NOW)).toBeNull();
    expect(sampleStore().coachWeeks.size).toBe(0);
  });

  it("shows nothing, and makes nothing, for a paused or pending shop", async () => {
    const { id, own } = await seller();
    expect(await readThisWeek({ id }, { ...own, status: "paused" }, NOW)).toBeNull();
    expect(await readThisWeek({ id }, { ...own, status: "pending" }, NOW)).toBeNull();
    expect(sampleStore().coachWeeks.size).toBe(0);
  });

  it("on Supabase makes nothing before Monday 06:00 SAST", async () => {
    const { id, own } = await seller();
    vi.mocked(onSupabase).mockReturnValue(true);
    vi.mocked(readOwnCoachWeeks).mockResolvedValueOnce([]);
    vi.mocked(saveCoachWeek).mockClear();
    expect(await readThisWeek({ id }, own, new Date("2026-11-09T03:00:00.000Z"))).toBeNull();
    expect(saveCoachWeek).not.toHaveBeenCalled();
  });

  it("gives a shop with nothing to do a week with no actions", async () => {
    const { id, slug, own } = await seller();
    await saveCoachWeek(slug, { week: WEEK, actions: [], writtenBy: "fixed", mentorQuestions: null }, NOW);
    const view = await readThisWeek({ id }, own, NOW);
    expect(view?.items).toEqual([]);
  });
});
