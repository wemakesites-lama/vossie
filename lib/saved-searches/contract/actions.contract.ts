import { randomUUID } from "node:crypto";
import { expect, it } from "vitest";
import { listSavedSearches } from "@/lib/data/saved-searches";
import { issueOnceToken } from "@/lib/staff/once";
import type { ActionScenario } from "@/tests/contract/actions";
import { saveThisSearch } from "../actions";
import { saveSearchNoteKey } from "../rules";

// Save this search on both backends (C4/C5 plan Task 8): its one-time token is taken through takeOnceToken, whose
// takeFormState is take_form_state on Supabase (Task 2), so a repeat of the post leaves the same line and saves
// nothing more, and a made-up token still saves (the search key keeps it single). actions.test.ts runs it on the
// sample store, actions.db.test.ts on the local stack.

const FROM = "/browse?q=calculator&campus=pretoria";
const FIELDS = { q: "calculator", campus: "pretoria", from: FROM };
const SEARCH = { q: "calculator", category: null, campus: "pretoria", price: null, pay: null, deals: null } as const;

export function saveSearchActionContract(scenario: () => ActionScenario): void {
  const setUp = async () => {
    await scenario().world.tidyCommunity();
    return (await scenario().signIn("asker"))!;
  };
  const mine = (asker: string) => scenario().world.asViewer("asker", () => listSavedSearches(asker));

  it("saves the search once however many times its form is sent, with the same line each time", async () => {
    const asker = await setUp();
    const once = (await issueOnceToken())!;
    expect((await scenario().post(saveThisSearch, { ...FIELDS, once })).redirect).toBe(FROM);
    expect(await scenario().notice(saveSearchNoteKey(SEARCH))).toMatchObject({ notice: "saved" });
    expect((await scenario().post(saveThisSearch, { ...FIELDS, once })).redirect).toBe(FROM);
    expect(await scenario().notice(saveSearchNoteKey(SEARCH))).toMatchObject({ notice: "saved", errors: [] });
    expect((await mine(asker)).map((item) => item.label)).toEqual(["“calculator” at Pretoria"]);
  });

  it("still saves with a made-up token, and says already the second time", async () => {
    const asker = await setUp();
    expect((await scenario().post(saveThisSearch, { ...FIELDS, once: randomUUID() })).redirect).toBe(FROM);
    expect(await mine(asker)).toHaveLength(1);
    await scenario().post(saveThisSearch, { ...FIELDS, campus: "pretoria", once: randomUUID() });
    expect((await scenario().notice(saveSearchNoteKey(SEARCH)))?.errors).toEqual(["already"]);
  });
}
