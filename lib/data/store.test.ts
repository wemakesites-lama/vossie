import { beforeEach, describe, expect, it, vi } from "vitest";
import { sampleAccounts } from "@/data/fixtures/accounts";
import { resetSampleStore, sampleStore, STORE_VERSION } from "./store";

beforeEach(() => {
  resetSampleStore();
});

describe("the sample store (accounts spec 2.1)", () => {
  it("is seeded with the sample accounts, their consents and their shops, and nothing else", () => {
    const store = sampleStore();
    expect([...store.accounts.keys()]).toEqual(sampleAccounts.map(({ account }) => account.id));
    expect(store.consents.size).toBe(5);
    expect([...store.sellerProfiles.keys()]).toEqual(["acc-seller", "acc-pending"]);
    expect(store.sessions.size).toBe(0);
    expect(store.signInAttempts.size).toBe(0);
    expect(store.codeSends.size).toBe(0);
    expect(store.sampleEmails.size).toBe(0);
    expect(store.formStates.size).toBe(0);
  });

  it("is one store for the whole process, so a module loaded again still shares it", async () => {
    const first = sampleStore();
    vi.resetModules();
    const again = await import("./store");
    expect(again.sampleStore()).toBe(first);
  });

  it("copies the fixtures, so a write never changes them", () => {
    sampleStore().accounts.get("acc-student")!.firstName = "Changed";
    sampleStore().accounts.get("acc-mentor")!.roles.push("admin");
    expect(sampleAccounts[0].account.firstName).toBe("Thandi");
    expect(sampleAccounts[3].account.roles).toEqual(["mentor"]);
  });

  it("starts again from the fixtures when reset", () => {
    sampleStore().accounts.delete("acc-student");
    resetSampleStore();
    expect(sampleStore().accounts.has("acc-student")).toBe(true);
  });

  it("reseeds a store left behind by an older version, as next dev keeps globalThis across reloads", () => {
    const old = sampleStore();
    old.version = STORE_VERSION - 1;
    old.accounts.clear();
    expect(sampleStore().version).toBe(STORE_VERSION);
    expect(sampleStore().accounts.size).toBe(5);
  });
});
