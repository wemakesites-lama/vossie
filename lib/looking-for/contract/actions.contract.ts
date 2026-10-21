import { randomUUID } from "node:crypto";
import { expect, it } from "vitest";
import { getOwnRequest, listOwnRequests } from "@/lib/data/requests";
import { addDays } from "@/lib/looking-for/rules";
import { issueOnceToken } from "@/lib/staff/once";
import { sastDate } from "@/lib/time";
import type { ActionScenario } from "@/tests/contract/actions";
import { closeMyRequest, deleteMyRequest, reopenMyRequest, saveMyRequest } from "../actions";
import { requestFormKey, requestNoteKey, YOUR_REQUESTS_FORM } from "../paths";

// The Looking For actions on both backends (C4/C5 plan Task 6; decisions 6 to 8 and 13): a new request is made once
// however many times its form is sent (the action takes the token on the sample store, save_request on Supabase), the
// limits, every action settling first, and Delete. The real Server Actions run as the world's "asker".
// actions.test.ts runs it on the sample store, actions.db.test.ts on the local stack.

const FORM = {
  title: "A contract desk lamp",
  category: "tech",
  campus: "pretoria",
  details: "A lamp that clips onto a desk, for the contract tests.",
  budget: "R150",
  neededBy: "",
};

export function lookingForActionsContract(scenario: () => ActionScenario): void {
  const setUp = async () => {
    const { world } = scenario();
    await world.tidyCommunity();
    await world.tidyMessaging();
    return (await scenario().signIn("asker"))!;
  };
  const mine = async (asker: string) =>
    scenario().world.asViewer("asker", () => listOwnRequests(asker, new Date()));

  it("makes a new request once, however many times its form is sent, landing both posts on its page", async () => {
    const asker = await setUp();
    const once = (await issueOnceToken())!;
    const first = await scenario().post(saveMyRequest, { ...FORM, once });
    expect(first.redirect).toMatch(/^\/looking-for\/[a-z0-9-]+$/);
    const id = first.redirect!.split("/").at(-1)!;
    expect(await scenario().notice(requestNoteKey(id))).toMatchObject({ notice: "posted" });
    expect(scenario().tags()).toContain("requests");
    const again = await scenario().post(saveMyRequest, { ...FORM, once });
    expect(again.redirect).toBe(`/looking-for/${id}`);
    expect((await mine(asker)).map((own) => own.request.id)).toEqual([id]);
  });

  it("refuses a made-up token with the form's form-expired error and what was typed, making nothing", async () => {
    const asker = await setUp();
    const posted = await scenario().post(saveMyRequest, { ...FORM, once: randomUUID() });
    expect(posted.redirect).toBe("/looking-for/new");
    expect(await scenario().notice(requestFormKey(null))).toMatchObject({
      errors: ["form-expired"],
      values: expect.objectContaining({ title: FORM.title, details: FORM.details, budget: "R150" }),
    });
    expect(await mine(asker)).toEqual([]);
  });

  it("stops at 5 open requests with open-limit, making nothing", async () => {
    const asker = await setUp();
    for (let n = 1; n <= 5; n += 1) await scenario().world.addRequest({ asker: "asker", title: `A contract open ${n}`, neededBy: null });
    const posted = await scenario().post(saveMyRequest, { ...FORM, once: (await issueOnceToken())! });
    expect(posted.redirect).toBe("/looking-for/new");
    expect((await scenario().notice(requestFormKey(null)))?.errors).toEqual(["open-limit"]);
    expect(await mine(asker)).toHaveLength(5);
  });

  it("settles first: Close on a request past its closing day finds it closed by itself, and Reopen clears its date", async () => {
    const asker = await setUp();
    const id = await scenario().world.addRequest({
      asker: "asker",
      title: "A contract late lamp",
      neededBy: addDays(sastDate(new Date()), -5),
    });
    const closed = await scenario().post(closeMyRequest, { request: id });
    expect(closed.redirect).toBe(`/looking-for/${id}`);
    expect(scenario().tags()).toContain("requests");
    const own = await scenario().world.asViewer("asker", () => getOwnRequest(asker, id, new Date()));
    expect(own).toMatchObject({ state: "closed", closedAutomatically: true });
    expect(await scenario().notice(requestNoteKey(id))).toBeNull();
    await scenario().post(reopenMyRequest, { request: id });
    expect(await scenario().notice(requestNoteKey(id))).toMatchObject({ notice: "reopened-date-cleared" });
    expect(await scenario().world.asViewer("asker", () => getOwnRequest(asker, id, new Date()))).toMatchObject({
      state: "open",
      request: { neededBy: null },
    });
  });

  it("deletes the asker's request, with the deleted line on Your requests", async () => {
    const asker = await setUp();
    const id = await scenario().world.addRequest({ asker: "asker", title: "A contract rug", neededBy: null });
    const deleted = await scenario().post(deleteMyRequest, { request: id });
    expect(deleted.redirect).toBe("/account/requests");
    expect(await scenario().notice(YOUR_REQUESTS_FORM)).toMatchObject({ notice: "deleted" });
    expect(await mine(asker)).toEqual([]);
  });
}
