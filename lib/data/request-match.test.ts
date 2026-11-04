import { beforeEach, describe, expect, it } from "vitest";
import type { MatchQuery } from "@/lib/types";
import { requestMatchCandidates, saveRequestMatch, unreadRequests } from "./request-match";
import { resetSampleStore, sampleStore } from "./store";

// The sample store's side of the matcher's data layer (AI stage G Task 4); the shared behaviour is in
// contract/request-match.contract.ts.

const LAMP: MatchQuery = { q: "desk lamp", category: "tech", campus: "pretoria", price: null, pay: null, deals: null };
const NOW = new Date("2026-11-04T08:00:00.000Z");

function askerRequest(id: string, overrides: Record<string, unknown> = {}) {
  const sample = sampleStore().requests.get("r-001")!;
  sampleStore().requests.set(id, {
    ...sample,
    id,
    askerId: "acc-student",
    campusSlug: "pretoria",
    status: "open",
    neededBy: null,
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
    ...overrides,
  });
}

beforeEach(() => {
  resetSampleStore();
});

describe("the matcher's data layer on the sample store", () => {
  it("refuses a search without a read", async () => {
    askerRequest("r-mine");
    await expect(saveRequestMatch("r-mine", LAMP, false, NOW)).rejects.toThrow("a search needs a read");
  });

  it("answers false for a request that's gone", async () => {
    expect(await saveRequestMatch("r-gone", LAMP, true, NOW)).toBe(false);
  });

  it("leaves out sample requests and closed ones", async () => {
    askerRequest("r-open");
    askerRequest("r-closed", { status: "closed" });
    askerRequest("r-idle", { updatedAt: "2026-09-01T08:00:00.000Z" });
    for (const id of ["r-open", "r-closed", "r-idle"]) await saveRequestMatch(id, LAMP, true, NOW);
    expect((await requestMatchCandidates("pretoria", "2026-11-04")).map((row) => row.id)).toEqual(["r-open"]);
    for (const id of ["r-open", "r-closed", "r-idle"]) await saveRequestMatch(id, null, false, NOW);
    const unread = (await unreadRequests("2026-11-04", 50)).map((row) => row.id);
    expect(unread).toEqual(["r-open"]);
  });

  it("lists the unread oldest first, at most the limit", async () => {
    askerRequest("r-b", { createdAt: "2026-11-02T08:00:00.000Z" });
    askerRequest("r-a", { createdAt: "2026-11-01T08:00:00.000Z" });
    askerRequest("r-c", { createdAt: "2026-11-03T08:00:00.000Z" });
    expect((await unreadRequests("2026-11-04", 2)).map((row) => row.id)).toEqual(["r-a", "r-b"]);
  });
});
