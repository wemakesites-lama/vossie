import { describe, expect, it } from "vitest";
import { sampleRequestRows } from "./request-rows";
import { requests } from "./requests";

describe("the sample requests as the store's rows (community actions plan decision 1)", () => {
  it("keeps every request's words, campus, budget and status, in the same order, with its offers as seedOffers", () => {
    expect(sampleRequestRows.map((row) => row.id)).toEqual(requests.map((request) => request.id));
    for (const [index, row] of sampleRequestRows.entries()) {
      const request = requests[index];
      expect(row, request.id).toMatchObject({
        title: request.title,
        categorySlug: request.categorySlug,
        campusSlug: request.campusSlug,
        details: request.details,
        budgetZar: request.budgetZar,
        swapWelcome: request.swapWelcome,
        neededBy: request.neededBy,
        status: request.status,
        createdAt: request.createdAt,
        updatedAt: request.createdAt,
        seedOffers: request.offers,
      });
    }
  });

  it("names no asker, and none is closed by anyone or hidden", () => {
    for (const row of sampleRequestRows) {
      expect([row.askerId, row.closedAt, row.hiddenAt, row.hiddenReason], row.id).toEqual([null, null, null, null]);
    }
  });
});
