import { beforeEach, describe, expect, it } from "vitest";
import { deleteAccountData } from "./accounts";
import { reservePhotoSearch } from "./photo-searches";
import { resetSampleStore, sampleStore } from "./store";

const NOW = new Date("2026-11-05T08:00:00.000Z");
const later = (ms: number) => new Date(NOW.getTime() + ms);
const HOUR = 60 * 60 * 1000;

beforeEach(() => resetSampleStore());

describe("reservePhotoSearch (AI features spec 5.4)", () => {
  it("allows up to the limit in any 24 hours, then refuses without counting", async () => {
    for (let i = 0; i < 3; i += 1) expect(await reservePhotoSearch("acc-1", later(i), 3)).toBe(true);
    expect(await reservePhotoSearch("acc-1", later(10), 3)).toBe(false);
    expect(sampleStore().photoSearches.get("acc-1")).toHaveLength(3);
    expect(await reservePhotoSearch("acc-2", later(10), 3)).toBe(true);
  });

  it("forgets searches more than 24 hours old", async () => {
    for (let i = 0; i < 3; i += 1) await reservePhotoSearch("acc-1", later(i), 3);
    expect(await reservePhotoSearch("acc-1", later(24 * HOUR + 1000), 3)).toBe(true);
    expect(sampleStore().photoSearches.get("acc-1")).toHaveLength(1);
  });

  it("is kept apart from photo-to-listing's count", async () => {
    await reservePhotoSearch("acc-1", NOW, 3);
    expect(sampleStore().photoFills.has("acc-1")).toBe(false);
  });

  it("goes with the account", async () => {
    const accountId = [...sampleStore().accounts.keys()][0]!;
    await reservePhotoSearch(accountId, NOW, 3);
    await deleteAccountData(accountId);
    expect(sampleStore().photoSearches.has(accountId)).toBe(false);
  });
});
