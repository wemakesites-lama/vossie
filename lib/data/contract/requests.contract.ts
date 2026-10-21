import { afterEach, beforeEach, expect, it } from "vitest";
import { getListedRequestIds, getOpenRequests, getRequest, getRequestIds, getRequests } from "@/lib/data";
import { settleRequests } from "@/lib/data/requests";
import { addDays } from "@/lib/looking-for/rules";
import { requestAutoClosedText, requestCloseReminderText } from "@/lib/looking-for/words";
import { sastDate } from "@/lib/time";
import type { World } from "@/tests/contract/world";

// Looking For requests in both backends (2b plan Task 17; stage L spec decisions 8 to 16, stage M 13 to 16): a request
// leaves every list on its closing day, settled or not; the settle stores the close and tells the asker once, and from
// 2 days before reminds them once; the samples never close. Times are the real clock's, since the database caps the
// settle's time at its own now(). requests.test.ts runs it on the sample store, requests.db.test.ts on the local stack.

/** The 16 sample requests, which no one asked (rq-001 to rq-016). */
const SAMPLES = 16;

export function requestsContract(makeWorld: () => World): void {
  let world: World;
  let now: Date;
  let today: string;
  beforeEach(() => {
    world = makeWorld();
    now = new Date();
    today = sastDate(now);
  });
  afterEach(async () => {
    await world.cleanup();
  });

  async function listed(): Promise<{ board: string[]; homepage: string[]; sitemap: readonly string[] }> {
    return {
      board: (await getOpenRequests({ category: null, today })).map((request) => request.id),
      homepage: (await getRequests({ campus: "all", limit: 1_000, today })).map((request) => request.id),
      sitemap: await getListedRequestIds({ today }),
    };
  }

  it("leaves a request out of every list on its closing day, before and after the settle, and tells the asker once", async () => {
    const title = "Contract calculator";
    const id = await world.addRequest({ asker: "asker", title, neededBy: addDays(today, -5) });
    const lists = await listed();
    expect(lists.board).not.toContain(id);
    expect(lists.homepage).not.toContain(id);
    expect(lists.sitemap).not.toContain(id);
    expect(await getRequest(id)).toMatchObject({ id, status: "open", closesOn: addDays(today, -1) });

    expect(await settleRequests(now)).toBe(1);
    const told = (await world.notificationsOf("asker")).filter((note) => note.subjectId === id);
    expect(told).toEqual([
      {
        kind: "request-update",
        subjectId: id,
        text: requestAutoClosedText(title, "needed-by"),
        href: "/account/requests",
      },
    ]);
    expect(told[0].text).toContain("3 days after the date you needed it by");

    expect(await settleRequests(now)).toBe(0);
    expect((await world.notificationsOf("asker")).filter((note) => note.subjectId === id)).toHaveLength(1);
    expect(await getRequest(id)).toMatchObject({ id, status: "closed" });
    expect(await getRequestIds()).toContain(id);
  });

  it("reminds the asker once, two days before the closing day, and leaves the request open", async () => {
    const title = "Contract desk lamp";
    const closesOn = addDays(today, 2);
    const id = await world.addRequest({ asker: "asker", title, neededBy: addDays(closesOn, -4) });
    expect((await listed()).board).toContain(id);

    expect(await settleRequests(now)).toBe(0);
    const told = (await world.notificationsOf("asker")).filter((note) => note.subjectId === id);
    expect(told.map((note) => note.text)).toEqual([requestCloseReminderText(title, closesOn, "needed-by")]);
    expect(await settleRequests(now)).toBe(0);
    expect((await world.notificationsOf("asker")).filter((note) => note.subjectId === id)).toHaveLength(1);
    expect(await getRequest(id)).toMatchObject({ status: "open", closesOn });
  });

  it("never closes the sample requests", async () => {
    const before = await getRequestIds();
    expect(before).toHaveLength(SAMPLES);
    const open = (await getOpenRequests({ category: null, today })).length;
    expect(await settleRequests(now)).toBe(0);
    expect((await getOpenRequests({ category: null, today })).length).toBe(open);
    for (const id of before) expect((await getRequest(id))?.closesOn, id).toBeNull();
  });
}
