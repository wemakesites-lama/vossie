import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, expect, it } from "vitest";
import { takeFormState } from "@/lib/data/form-states";
import type { World } from "@/tests/contract/world";

// One-time tokens taken through takeFormState in both backends (C4/C5 plan Task 2, decision 6): save this search's
// "staff-once:" token is taken by the first post only, as a new listing's "listing-once:" one is. On Supabase the
// database's take_form_state checks and marks the session's row under its lock; in the sample store, one step with
// nothing awaited. form-states.test.ts runs it on the sample store, form-states.db.test.ts on the local stack.

export function formStatesContract(makeWorld: () => World): void {
  let world: World;
  beforeEach(() => {
    world = makeWorld();
  });
  afterEach(async () => {
    await world.cleanup();
  });

  for (const prefix of ["staff-once", "listing-once"]) {
    it(`takes a ${prefix} token for the first post only, then again with the row as the first left it`, async () => {
      const form = `${prefix}:${randomUUID()}`;
      const sessionKey = await world.onceRow("asker", form);
      const now = new Date();
      const first = await world.asViewer("asker", () => takeFormState(sessionKey, form, now));
      expect(first).toMatchObject({ first: true, state: { sessionKey, form, taken: true } });
      const again = await world.asViewer("asker", () => takeFormState(sessionKey, form, now));
      expect(again).toMatchObject({ first: false, state: { sessionKey, form, taken: true } });
    });
  }

  it("gives none for a made-up token, a run-out one, or a form that isn't a token", async () => {
    const sessionKey = await world.onceRow("asker", `staff-once:${randomUUID()}`);
    const outOfTime = `staff-once:${randomUUID()}`;
    await world.onceRow("asker", outOfTime, { expiresInMinutes: -1 });
    const notAToken = "listing:new";
    await world.onceRow("asker", notAToken);
    const now = new Date();
    for (const form of [`staff-once:${randomUUID()}`, outOfTime]) {
      expect(await world.asViewer("asker", () => takeFormState(sessionKey, form, now))).toBeNull();
    }
    // The sample store takes any form it's asked about; only the database knows which forms are tokens. No caller asks
    // about any other form (takeOnceToken and takeListingToken build theirs), so the contract checks the tokens only.
    if (world.name === "supabase") {
      expect(await world.asViewer("asker", () => takeFormState(sessionKey, notAToken, now))).toBeNull();
    }
  });

  it("never takes another account's token", async () => {
    const form = `staff-once:${randomUUID()}`;
    await world.onceRow("shopper", form);
    const mine = await world.onceRow("asker", `staff-once:${randomUUID()}`);
    expect(await world.asViewer("asker", () => takeFormState(mine, form, new Date()))).toBeNull();
  });
}
