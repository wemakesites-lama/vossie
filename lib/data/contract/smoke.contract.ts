import { afterEach, beforeEach, expect, it } from "vitest";
import { getCampuses } from "@/lib/data";
import type { World } from "@/tests/contract/world";

// The harness's smoke contract (2b plan Task 13): one read and the world's accounts, the same in both backends.
// smoke.test.ts runs it on the sample store (`pnpm test`), smoke.db.test.ts on the local stack (`pnpm test:db`).

export function smokeContract(makeWorld: () => World): void {
  let world: World;
  beforeEach(() => {
    world = makeWorld();
  });
  afterEach(async () => {
    await world.cleanup();
  });

  it("reads the 13 campuses", async () => {
    expect(await getCampuses()).toHaveLength(13);
  });

  it("signs a test account in and gives the same id each time, one per account", async () => {
    const asker = await world.signedIn("asker");
    expect(asker).toEqual(expect.any(String));
    expect(await world.signedIn("asker")).toBe(asker);
    expect(await world.signedIn("shopper")).not.toBe(asker);
  });

  it("runs a read with that account as the viewer", async () => {
    expect(await world.asViewer("asker", (accountId) => accountId)).toBe(await world.signedIn("asker"));
    expect(await world.asViewer("staff", async (accountId) => accountId)).toBe(await world.signedIn("staff"));
  });
}
