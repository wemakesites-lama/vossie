import { beforeEach, describe, expect, it } from "vitest";
import type { Measure, Period, RawCounts } from "@/lib/staff/numbers";
import { listedListings, liveSellerRows } from "./catalog";
import { addFollow } from "./follows";
import { countByWeek } from "./numbers";
import { closeReport } from "./staff-reports";
import { createReport } from "./reports";
import type { ConversationRow } from "./rows";
import { approveShop, staffPauseShop } from "./staff-shops";
import { resetSampleStore, sampleStore } from "./store";

// Tuesday 20 October 2026, 10:00 in South Africa: last week is 12 to 18 October, the week before 5 to 11 October.
const NOW = new Date("2026-10-20T08:00:00.000Z");
const LAST_WEEK = new Date("2026-10-14T08:00:00.000Z");
const WEEK_BEFORE = new Date("2026-10-07T08:00:00.000Z");
const THIS_WEEK = new Date("2026-10-19T09:00:00.000Z");

beforeEach(() => {
  resetSampleStore();
});

const at = (raw: RawCounts, measure: Measure, period: Period, campus: string) => raw.counts[measure][period].campuses[campus] ?? 0;
const gone = (raw: RawCounts, measure: Measure, period: Period) => raw.counts[measure][period].gone;

async function counted() {
  return (await countByWeek(NOW)).raw;
}

/** A conversation row with the fields that matter here. */
function conversation(id: string, overrides: Partial<ConversationRow>): ConversationRow {
  return {
    id,
    listingId: "l-001",
    listingTitle: "Casio fx-991ZA Plus calculator",
    sellerSlug: "tech-corner",
    buyerId: "acc-student",
    sellerGone: false,
    status: "asked",
    createdAt: LAST_WEEK.toISOString(),
    lastMessageAt: LAST_WEEK.toISOString(),
    firstReplyAt: null,
    completedAt: null,
    confirmedAt: null,
    confirmedBy: null,
    ...overrides,
  };
}

describe("the weeks (stage J spec decision 11)", () => {
  it("counts in the two complete SAST weeks before now, and gives their dates", async () => {
    const { weeks } = await countByWeek(NOW);
    expect(weeks.last.label).toBe("12 to 18 Oct");
    expect(weeks.before.label).toBe("5 to 11 Oct");
  });
});

describe("listings published (stage J spec decision 10)", () => {
  it("counts a listing at its first publish, on its campus, in its week and since the start", async () => {
    const before = await counted();
    const row = structuredClone(sampleStore().listings.get("l-001")!);
    Object.assign(row, { id: "l-new", campusSlug: "pretoria", firstPublishedAt: LAST_WEEK.toISOString() });
    sampleStore().listings.set(row.id, row);
    const after = await counted();
    expect(at(after, "listings", "last", "pretoria") - at(before, "listings", "last", "pretoria")).toBe(1);
    expect(at(after, "listings", "since", "pretoria") - at(before, "listings", "since", "pretoria")).toBe(1);
    expect(at(after, "listings", "before", "pretoria")).toBe(at(before, "listings", "before", "pretoria"));
  });

  it("counts a listing saved back as a draft and published again once, at its first publish", async () => {
    const before = await counted();
    const row = structuredClone(sampleStore().listings.get("l-001")!);
    // Published the week before, then a draft, then published again last week: firstPublishedAt never moves.
    Object.assign(row, {
      id: "l-again",
      campusSlug: "pretoria",
      firstPublishedAt: WEEK_BEFORE.toISOString(),
      updatedAt: LAST_WEEK.toISOString(),
    });
    sampleStore().listings.set(row.id, row);
    const after = await counted();
    expect(at(after, "listings", "before", "pretoria") - at(before, "listings", "before", "pretoria")).toBe(1);
    expect(at(after, "listings", "last", "pretoria")).toBe(at(before, "listings", "last", "pretoria"));
  });

  it("doesn't count a draft never published, or anything from this week", async () => {
    const before = await counted();
    const draft = structuredClone(sampleStore().listings.get("l-001")!);
    Object.assign(draft, { id: "l-draft", state: "draft", firstPublishedAt: null });
    const fresh = structuredClone(sampleStore().listings.get("l-001")!);
    Object.assign(fresh, { id: "l-fresh", firstPublishedAt: THIS_WEEK.toISOString() });
    sampleStore().listings.set(draft.id, draft);
    sampleStore().listings.set(fresh.id, fresh);
    expect(await counted()).toEqual(before);
  });
});

describe("shops approved (stage J spec decision 10)", () => {
  it("counts a student's shop at its first approval, and not while it waits", async () => {
    const before = await counted();
    expect(at(before, "shops", "since", "pretoria")).toBe(
      [...sampleStore().sellers.values()].filter((row) => row.ownerId === null && row.campusSlug === "pretoria").length,
    );
    await approveShop("crochet-corner", "acc-pending", LAST_WEEK);
    const after = await counted();
    expect(at(after, "shops", "last", "pretoria") - at(before, "shops", "last", "pretoria")).toBe(1);
  });

  it("counts a sample shop no account owns at its createdAt", async () => {
    const before = await counted();
    const shop = [...sampleStore().sellers.values()].find((row) => row.ownerId === null && row.campusSlug === "midrand")!;
    shop.createdAt = LAST_WEEK.toISOString();
    const after = await counted();
    expect(at(after, "shops", "last", "midrand") - at(before, "shops", "last", "midrand")).toBe(1);
  });
});

describe("enquiries started (stage J spec decision 10)", () => {
  it("counts a buyer's conversation on its shop's campus, and leaves offers out", async () => {
    const before = await counted();
    sampleStore().conversations.set("conv-e1", conversation("conv-e1", {}));
    sampleStore().conversations.set("conv-o1", conversation("conv-o1", { requestId: "r-001", requestTitle: "A lab coat" }));
    const after = await counted();
    expect(at(after, "enquiries", "last", "midrand") - at(before, "enquiries", "last", "midrand")).toBe(1);
  });

  it("counts an enquiry to a shop that has gone in the total only", async () => {
    const before = await counted();
    sampleStore().conversations.set("conv-g1", conversation("conv-g1", { sellerGone: true }));
    const after = await counted();
    expect(gone(after, "enquiries", "last") - gone(before, "enquiries", "last")).toBe(1);
    expect(at(after, "enquiries", "last", "midrand")).toBe(at(before, "enquiries", "last", "midrand"));
  });
});

describe("reports made and closed (stage J spec decision 10)", () => {
  it("counts a report when it's made and when it's closed, on its target's campus", async () => {
    const before = await counted();
    const id = await createReport({
      reporterId: "acc-student",
      target: { kind: "listing", id: "l-001" },
      targetTitle: "Casio fx-991ZA Plus calculator",
      reason: "scam",
      detail: "",
      now: WEEK_BEFORE,
    });
    await closeReport(id, "Looked fine.", "acc-admin", LAST_WEEK);
    const after = await counted();
    expect(at(after, "reports-made", "before", "midrand") - at(before, "reports-made", "before", "midrand")).toBe(1);
    expect(at(after, "reports-closed", "last", "midrand") - at(before, "reports-closed", "last", "midrand")).toBe(1);
    expect(at(after, "reports-closed", "before", "midrand")).toBe(at(before, "reports-closed", "before", "midrand"));
  });

  it("counts a report on something that has gone in the total only", async () => {
    const before = await counted();
    const id = await createReport({
      reporterId: "acc-student",
      target: { kind: "seller", id: "tech-corner" },
      targetTitle: "Tech corner",
      reason: "scam",
      detail: "",
      now: LAST_WEEK,
    });
    sampleStore().reports.get(id)!.targetGone = true;
    const after = await counted();
    expect(gone(after, "reports-made", "last") - gone(before, "reports-made", "last")).toBe(1);
  });
});

describe("shops followed (stage J spec decision 10)", () => {
  it("counts a follow on the followed shop's campus", async () => {
    const before = await counted();
    expect(await addFollow("acc-student", "tech-corner", LAST_WEEK)).toBe("followed");
    const after = await counted();
    expect(at(after, "follows", "last", "midrand") - at(before, "follows", "last", "midrand")).toBe(1);
  });
});

describe("open shops now (stage J spec decision 10, plan decision 12)", () => {
  it("counts approved, unpaused shops with something listed, Verified or not", async () => {
    const { openShops } = await counted();
    const listed = new Set(listedListings().map((listing) => listing.sellerSlug));
    const expected = liveSellerRows().filter((row) => listed.has(row.slug));
    expect(Object.values(openShops.campuses).reduce((sum, count) => sum + count, 0)).toBe(expected.length);
    expect(expected.some((row) => !row.verified)).toBe(true);
    expect(openShops.gone).toBe(0);
  });

  it("drops a shop the Hub pauses", async () => {
    const before = (await counted()).openShops.campuses.midrand ?? 0;
    await staffPauseShop("tech-corner", "Checking it.");
    expect((await counted()).openShops.campuses.midrand ?? 0).toBe(before - 1);
  });
});
