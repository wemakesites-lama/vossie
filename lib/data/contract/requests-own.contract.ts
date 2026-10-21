import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, expect, it } from "vitest";
import { getRequest } from "@/lib/data";
import { isRefused } from "@/lib/data/refused";
import {
  countOpenRequests,
  countRequestsSince,
  createRequest,
  deleteRequest,
  exportRequests,
  getOwnRequest,
  hideRequest,
  listOwnRequests,
  setRequestOpen,
  settleRequests,
  showRequest,
  updateRequest,
} from "@/lib/data/requests";
import { addDays, type RequestFields } from "@/lib/looking-for/rules";
import { requestAutoClosedText } from "@/lib/looking-for/words";
import { sastDate } from "@/lib/time";
import type { World } from "@/tests/contract/world";

// Looking For requests, the asker's side, in both backends (C4/C5 plan Task 4; decisions 2, 6 to 8): the asker's own
// reads (settled first), posting, editing, closing, reopening and deleting, the Hub's hide and Show again, and the data
// download. Times are the real clock's, since the database caps `now` at its own. requests-own.test.ts runs it on the
// sample store, requests-own.db.test.ts on the local stack.

const DAY = 86_400_000;
const FIELDS: RequestFields = {
  title: "A contract desk lamp",
  categorySlug: "tech",
  campusSlug: "pretoria",
  details: "A lamp that clips onto a desk, for the contract tests.",
  budgetZar: 150,
  swapWelcome: true,
  neededBy: null,
};

/** A short wait, so two rows made one after the other never share a time (the sample sorts by it). */
const tick = () => new Promise((resolve) => setTimeout(resolve, 5));

export function requestsOwnContract(makeWorld: () => World): void {
  let world: World;
  let asker: string;
  beforeEach(async () => {
    world = makeWorld();
    await world.tidyCommunity();
    await world.tidyMessaging();
    asker = await world.signedIn("asker");
  });
  afterEach(async () => {
    await world.cleanup();
  });

  /** A one-time token for a new request: on Supabase save_request takes it (decision 6); the sample ignores it. */
  const token = async () => {
    const value = randomUUID();
    await world.onceRow("asker", `staff-once:${value}`);
    return value;
  };
  const post = async (fields: Partial<RequestFields> = {}) => {
    const onceToken = await token();
    return world.asViewer("asker", () =>
      createRequest({ askerId: asker, fields: { ...FIELDS, ...fields }, now: new Date(), onceToken }),
    );
  };
  const own = (id: string) => world.asViewer("asker", () => getOwnRequest(asker, id, new Date()));

  // --- The asker's reads ---------------------------------------------------------------------------------------------

  it("reads the asker's own request: open, not closed by itself, closing 30 days on", async () => {
    const id = await world.addRequest({ asker: "asker", title: "A contract kettle", neededBy: null });
    const today = sastDate(new Date());
    expect(await own(id)).toMatchObject({
      state: "open",
      closedAutomatically: false,
      closeReason: null,
      neededByPassed: false,
      request: { id, title: "A contract kettle", offers: 0, closesOn: addDays(today, 30) },
    });
  });

  it("never gives another account's request", async () => {
    const id = await world.addRequest({ asker: "shopper", title: "A contract shopper's kettle", neededBy: null });
    expect(await own(id)).toBeNull();
  });

  it("lists the asker's requests open, then closed, then hidden, each newest first, and counts them", async () => {
    const first = await world.addRequest({ asker: "asker", title: "A contract first", neededBy: null });
    await tick();
    const closed = await world.addRequest({ asker: "asker", title: "A contract closed", neededBy: null });
    await tick();
    const hidden = await world.addRequest({ asker: "asker", title: "A contract hidden", neededBy: null });
    await tick();
    const second = await world.addRequest({ asker: "asker", title: "A contract second", neededBy: null });
    await world.addRequest({ asker: "shopper", title: "A contract other", neededBy: null });
    expect(await world.asViewer("asker", () => setRequestOpen(asker, closed, false, new Date()))).toMatchObject({
      id: closed,
      status: "closed",
      neededByCleared: false,
    });
    await world.hideRequest(hidden, "Contract reason");
    const listed = await world.asViewer("asker", () => listOwnRequests(asker, new Date()));
    expect(listed.map((row) => [row.request.id, row.state])).toEqual([
      [second, "open"],
      [first, "open"],
      [closed, "closed"],
      [hidden, "hidden"],
    ]);
    expect(listed[3]).toMatchObject({ hiddenReason: "Contract reason" });
    expect(await world.asViewer("asker", () => countOpenRequests(asker, new Date()))).toBe(2);
    expect(await world.asViewer("asker", () => countRequestsSince(asker, new Date(Date.now() - DAY)))).toBe(4);
    expect(await world.asViewer("asker", () => countRequestsSince(asker, new Date(Date.now() + 60_000)))).toBe(0);
  });

  it("settles first: a request whose needed-by date passed 5 days ago reads as closed by itself, told once", async () => {
    const neededBy = addDays(sastDate(new Date()), -5);
    const id = await world.addRequest({ asker: "asker", title: "A contract late lamp", neededBy });
    expect(await own(id)).toMatchObject({
      state: "closed",
      closedAutomatically: true,
      closeReason: "needed-by",
      neededByPassed: true,
    });
    const told = (await world.notificationsOf("asker")).filter((note) => note.subjectId === id);
    expect(told).toEqual([
      { kind: "request-update", subjectId: id, text: requestAutoClosedText("A contract late lamp", "needed-by"), href: "/account/requests" },
    ]);
    await own(id);
    expect(await world.asViewer("asker", () => listOwnRequests(asker, new Date()))).toHaveLength(1);
    expect((await world.notificationsOf("asker")).filter((note) => note.subjectId === id)).toHaveLength(1);
  });

  // --- The writes ----------------------------------------------------------------------------------------------------

  it("posts a request with the fields as given and no offers", async () => {
    const posted = await post({ neededBy: addDays(sastDate(new Date()), 7) });
    expect(posted).toMatchObject({
      title: FIELDS.title,
      categorySlug: "tech",
      campusSlug: "pretoria",
      details: FIELDS.details,
      budgetZar: 150,
      swapWelcome: true,
      neededBy: addDays(sastDate(new Date()), 7),
      status: "open",
      offers: 0,
    });
    expect(await own(posted.id)).toMatchObject({ state: "open", request: { id: posted.id } });
    expect(await getRequest(posted.id)).toMatchObject({ id: posted.id, title: FIELDS.title });
  });

  it("on Supabase, the database takes the token: a second post with it is once-taken, a made-up one once-expired", async () => {
    if (world.name !== "supabase") return;
    const onceToken = await token();
    const make = (value: string) =>
      world.asViewer("asker", () => createRequest({ askerId: asker, fields: FIELDS, now: new Date(), onceToken: value }));
    await make(onceToken);
    expect(isRefused(await make(onceToken).catch((error: unknown) => error), "once-taken")).toBe(true);
    expect(isRefused(await make(randomUUID()).catch((error: unknown) => error), "once-expired")).toBe(true);
    expect(await world.asViewer("asker", () => countRequestsSince(asker, new Date(Date.now() - DAY)))).toBe(1);
  });

  it("edits an open request, and not a closed one", async () => {
    const id = await world.addRequest({ asker: "asker", title: "A contract mug", neededBy: null });
    const edited = await world.asViewer("asker", () =>
      updateRequest(asker, id, { ...FIELDS, title: "A contract bigger mug" }, new Date()),
    );
    expect(edited).toMatchObject({ id, title: "A contract bigger mug", budgetZar: 150 });
    expect((await own(id))?.request.title).toBe("A contract bigger mug");
    await world.asViewer("asker", () => setRequestOpen(asker, id, false, new Date()));
    expect(await world.asViewer("asker", () => updateRequest(asker, id, FIELDS, new Date()))).toBeNull();
    expect((await own(id))?.request.title).toBe("A contract bigger mug");
  });

  it("closes by hand and reopens, and a second press changes nothing", async () => {
    const id = await world.addRequest({ asker: "asker", title: "A contract stool", neededBy: null });
    expect(await world.asViewer("asker", () => setRequestOpen(asker, id, false, new Date()))).toMatchObject({ id, status: "closed" });
    expect(await own(id)).toMatchObject({ state: "closed", closedAutomatically: false });
    expect(await world.asViewer("asker", () => setRequestOpen(asker, id, false, new Date()))).toBeNull();
    expect(await world.asViewer("asker", () => setRequestOpen(asker, id, true, new Date()))).toMatchObject({
      id,
      status: "open",
      neededByCleared: false,
    });
    expect(await own(id)).toMatchObject({ state: "open", closedAt: null });
  });

  it("reopening takes off a needed-by date that has passed", async () => {
    const neededBy = addDays(sastDate(new Date()), -1);
    const id = await world.addRequest({ asker: "asker", title: "A contract chair", neededBy });
    await world.asViewer("asker", () => setRequestOpen(asker, id, false, new Date()));
    expect(await world.asViewer("asker", () => setRequestOpen(asker, id, true, new Date()))).toMatchObject({
      id,
      neededBy: null,
      neededByCleared: true,
    });
    expect((await own(id))?.request.neededBy).toBeNull();
  });

  it("on Supabase, Close settles first: a due request closes by itself, and Close changes nothing", async () => {
    // The sample's settle-first is the action's (settle(now) in lib/looking-for/actions.ts); Task 6 proves it there.
    if (world.name !== "supabase") return;
    const id = await world.addRequest({ asker: "asker", title: "A contract due lamp", neededBy: addDays(sastDate(new Date()), -5) });
    expect(await world.asViewer("asker", () => setRequestOpen(asker, id, false, new Date()))).toBeNull();
    expect(await own(id)).toMatchObject({ state: "closed", closedAutomatically: true });
  });

  it("on Supabase, reopening a sixth past five open is the database's reopen-limit", async () => {
    if (world.name !== "supabase") return;
    const closed = await world.addRequest({ asker: "asker", title: "A contract sixth", neededBy: null });
    await world.asViewer("asker", () => setRequestOpen(asker, closed, false, new Date()));
    for (let n = 1; n <= 5; n += 1) await world.addRequest({ asker: "asker", title: `A contract open ${n}`, neededBy: null });
    const refused = await world.asViewer("asker", () => setRequestOpen(asker, closed, true, new Date())).catch((error: unknown) => error);
    expect(isRefused(refused, "reopen-limit")).toBe(true);
    expect((await own(closed))?.state).toBe("closed");
  });

  it("deletes the asker's request, once, and its page goes", async () => {
    const id = await world.addRequest({ asker: "asker", title: "A contract rug", neededBy: null });
    const other = await world.addRequest({ asker: "shopper", title: "A contract shopper's rug", neededBy: null });
    expect(await world.asViewer("asker", () => deleteRequest(asker, other))).toBe(false);
    expect(await world.asViewer("asker", () => deleteRequest(asker, id))).toBe(true);
    expect(await world.asViewer("asker", () => deleteRequest(asker, id))).toBe(false);
    expect(await getRequest(id)).toBeNull();
    expect(await getRequest(other)).not.toBeNull();
  });

  // --- The Hub's hide and Show again (C5's callers; the twin lives here) ---------------------------------------------

  it("hides a reported request, once, and shows it again, once", async () => {
    const id = await world.addRequest({ asker: "asker", title: "A contract reported lamp", neededBy: null });
    await world.addReport("shopper", { kind: "request", id });
    const staff = () => world.asViewer("staff", () => hideRequest(id, "Contract reason", new Date()));
    // The admin can't read who asked on Supabase, and the function told them itself (decision 2's note).
    const askerId = world.name === "supabase" ? null : asker;
    expect(await staff()).toEqual({ id, title: "A contract reported lamp", askerId });
    expect(await staff()).toBeNull();
    expect(await own(id)).toMatchObject({ state: "hidden", hiddenReason: "Contract reason" });
    expect(await getRequest(id)).toBeNull();
    const show = () => world.asViewer("staff", () => showRequest(id, new Date()));
    expect(await show()).toEqual({ id, title: "A contract reported lamp", askerId });
    expect(await show()).toBeNull();
    expect(await own(id)).toMatchObject({ state: "open", hiddenReason: null });
  });

  it("settles before the hide: a due request hidden ends closed by itself and hidden", async () => {
    const id = await world.addRequest({ asker: "asker", title: "A contract due rug", neededBy: addDays(sastDate(new Date()), -5) });
    await world.addReport("shopper", { kind: "request", id });
    // As hideReportedRequest does on the sample store; on Supabase the twin settles itself as well (decision 8).
    if (world.name === "sample") await settleRequests(new Date());
    await world.asViewer("staff", () => hideRequest(id, "Contract reason", new Date()));
    expect(await own(id)).toMatchObject({ state: "hidden", closedAutomatically: true, request: { status: "closed" } });
  });

  // --- The download --------------------------------------------------------------------------------------------------

  it("puts the asker's requests in the download, newest first, with no ids", async () => {
    const auto = await world.addRequest({ asker: "asker", title: "A contract old lamp", neededBy: addDays(sastDate(new Date()), -5) });
    await tick();
    const hidden = await world.addRequest({ asker: "asker", title: "A contract hidden lamp", neededBy: null });
    await world.hideRequest(hidden, "Contract reason");
    await world.asViewer("asker", () => settleRequests(new Date()));
    const download = await world.asViewer("asker", () => exportRequests(asker));
    expect(download).toEqual([
      expect.objectContaining({ title: "A contract hidden lamp", state: "hidden", hubReason: "Contract reason", closedAutomatically: false, offers: 0 }),
      expect.objectContaining({ title: "A contract old lamp", state: "closed", hubReason: null, closedAutomatically: true, offers: 0 }),
    ]);
    expect(download[0]).toEqual({
      title: "A contract hidden lamp",
      category: "Tech",
      campus: "Pretoria",
      details: "A request the contract tests post and the world takes away again.",
      budgetZar: null,
      swapWelcome: false,
      neededBy: null,
      state: "hidden",
      hubReason: "Contract reason",
      postedAt: expect.any(String),
      closedAt: null,
      closedAutomatically: false,
      offers: 0,
    });
    expect(JSON.stringify(download)).not.toContain(auto);
    expect(JSON.stringify(download)).not.toContain(hidden);
  });
}
