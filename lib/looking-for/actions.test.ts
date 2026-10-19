import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFormState } from "@/lib/auth/form-state";
import type { RequestFields } from "@/lib/looking-for/rules";
import { startOffer } from "@/lib/data/messages";
import { createRequest, getOwnRequest } from "@/lib/data/requests";
import { resetSampleStore, sampleStore } from "@/lib/data/store";
import { sentNoteKey } from "@/lib/messaging/paths";
import { issueOnceToken, ONCE_TTL_MS, takeOnceToken } from "@/lib/staff/once";
import { redirectOf, redirectSignalOf, resetRequest, type FakeRequest } from "@/tests/helpers/next-request";
import { form, signedInAs, STAFF_NOW } from "@/tests/helpers/staff";
import { closeMyRequest, deleteMyRequest, reopenMyRequest, saveMyRequest, sendOffer } from "./actions";
import { offerFormKey, requestFormKey, requestNoteKey, YOUR_REQUESTS_FORM } from "./paths";

const request = vi.hoisted((): FakeRequest => ({ cookies: new Map(), sent: new Map(), proto: "http" }));

vi.mock("next/headers", async () => (await import("@/tests/helpers/next-request")).nextHeaders(request));
vi.mock("next/navigation", async () => (await import("@/tests/helpers/next-request")).nextNavigation());
vi.mock("next/server", async () => (await import("@/tests/helpers/next-request")).nextServer());
vi.mock("next/cache", async () => (await import("@/tests/helpers/next-request")).nextCache(request));

beforeEach(() => {
  resetSampleStore();
  resetRequest(request);
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(STAFF_NOW);
});

const asStudent = () => signedInAs(request, "acc-student");

/** The request form as the browser posts it (spec 2.3). */
const FORM = {
  title: "Desk lamp for res",
  category: "res-living",
  campus: "midrand",
  details: "A lamp that clips onto a desk, by the weekend.",
  budget: "R150",
  neededBy: "2026-10-20",
};

const FIELDS: RequestFields = {
  title: "Desk lamp for res",
  categorySlug: "res-living",
  campusSlug: "midrand",
  details: "A lamp that clips onto a desk, by the weekend.",
  budgetZar: 150,
  swapWelcome: false,
  neededBy: null,
};

const posted = (askerId = "acc-student") => createRequest({ askerId, fields: FIELDS, now: STAFF_NOW });

/** The new request form as it's drawn: with a fresh one-time token for whoever is signed in (plan amendment 3). */
const newForm = async (overrides: Record<string, string> = {}) =>
  form({ ...FORM, once: (await issueOnceToken()) ?? "", ...overrides });

const send = (overrides: Record<string, string> = {}) =>
  redirectSignalOf(async () => saveMyRequest(await newForm(overrides)));

describe("Post request (community actions spec 2.3 to 2.5)", () => {
  it("posts it, expires the board, and opens its page with a status line", async () => {
    await asStudent();
    const redirect = await send({ swap: "yes" });
    expect(redirect.url).toMatch(/^\/looking-for\/r-[0-9a-f-]{36}$/);
    expect([redirect.type, request.refreshed, request.updatedTags]).toEqual(["replace", true, ["requests"]]);
    const id = redirect.url.split("/").at(-1)!;
    expect(await getOwnRequest("acc-student", id)).toMatchObject({
      state: "open",
      request: { title: "Desk lamp for res", budgetZar: 150, swapWelcome: true, neededBy: "2026-10-20" },
    });
    expect(await readFormState(requestNoteKey(id))).toMatchObject({ notice: "posted" });
  });

  it("keeps what was typed and says what's wrong, storing nothing", async () => {
    await asStudent();
    const redirect = await send({ title: "Lamp", details: "Call 0821234567 about my lamp please." });
    expect([redirect.url, redirect.type, request.refreshed]).toEqual(["/looking-for/new", "replace", false]);
    expect(await readFormState(requestFormKey(null))).toMatchObject({
      errors: ["title-length", "details-contact"],
      values: { title: "Lamp", details: "Call 0821234567 about my lamp please.", budget: "R150", swap: "" },
    });
    expect(sampleStore().requests.size).toBe(16);
  });

  // Review of Tasks 6 to 15 (plan amendment 19.8): form state holds no stranger's text, as selling's listing form.
  it("keeps only a category and a campus that exist when it hands the typed values back", async () => {
    await asStudent();
    await send({ title: "Lamp", category: "x".repeat(500), campus: "<b>mars</b>" });
    expect((await readFormState(requestFormKey(null)))?.values).toMatchObject({ category: "", campus: "", title: "Lamp" });
    await send({ title: "Lamp", category: "res-living", campus: "online" });
    expect((await readFormState(requestFormKey(null)))?.values).toMatchObject({ category: "res-living", campus: "online" });
  });

  it("stops at 5 open requests, then at 5 posted in a day (spec 2.5, plan decision 4)", async () => {
    await asStudent();
    for (let n = 0; n < 5; n += 1) await posted();
    expect((await send()).url).toBe("/looking-for/new");
    expect((await readFormState(requestFormKey(null)))?.errors).toEqual(["open-limit"]);
    for (const row of sampleStore().requests.values()) {
      if (row.askerId === "acc-student") row.status = "closed";
    }
    await send();
    expect((await readFormState(requestFormKey(null)))?.errors).toEqual(["daily-limit"]);
  });

  it("sends a signed-out visitor to sign in, storing nothing", async () => {
    expect(await redirectOf(() => saveMyRequest(form(FORM)))).toBe("/login?next=%2Flooking-for%2Fnew");
    expect(sampleStore().requests.size).toBe(16);
  });
});

describe("a new request is made once, however many times its form is sent (plan amendment 3)", () => {
  const FORGED = "00000000-0000-4000-8000-000000000000";
  const mine = () => [...sampleStore().requests.values()].filter((row) => row.askerId === "acc-student");

  it("makes one request from two posts with one token, and sends the second to the first one's page", async () => {
    await asStudent();
    const once = (await issueOnceToken())!;
    const first = await send({ once });
    expect(first.url).toMatch(/^\/looking-for\/r-[0-9a-f-]{36}$/);
    const again = await send({ once, title: "Desk lamp, second go" });
    expect([again.url, again.type, request.refreshed]).toEqual([first.url, "replace", true]);
    expect(mine()).toHaveLength(1);
    expect(mine()[0].title).toBe("Desk lamp for res");
    // Only the post that made the request told the board.
    expect(request.updatedTags).toEqual(["requests"]);
  });

  it("sends the second post to the first one's page even when the first took the account to a limit", async () => {
    await asStudent();
    for (let n = 0; n < 4; n += 1) await posted();
    const once = (await issueOnceToken())!;
    const first = await send({ once });
    expect(first.url).toMatch(/^\/looking-for\/r-/);
    // The account has 5 open requests now, but a repeat of the post that made the fifth isn't an error.
    expect((await send({ once })).url).toBe(first.url);
    expect(await readFormState(requestFormKey(null))).toBeNull();
    expect(mine()).toHaveLength(5);
  });

  it("makes one request when posts are sent together, as a browser without the app's JavaScript can", async () => {
    await asStudent();
    const once = (await issueOnceToken())!;
    const results = await Promise.all([send({ once }), send({ once }), send({ once })]);
    expect(mine()).toHaveLength(1);
    const page = `/looking-for/${mine()[0].id}`;
    // The ones that lost the race go to the first's page, or to Your requests while it is still saving.
    for (const result of results) expect([page, "/account/requests"]).toContain(result.url);
    expect(request.updatedTags).toEqual(["requests"]);
  });

  it("sends a post that comes while the first is still saving to Your requests, and makes nothing", async () => {
    await asStudent();
    const once = (await issueOnceToken())!;
    // The first has taken the token and has not said where it went.
    expect(await takeOnceToken(once, STAFF_NOW)).toEqual({ kind: "first" });
    expect((await send({ once })).url).toBe("/account/requests");
    expect(mine()).toHaveLength(0);
    expect(request.updatedTags).toEqual([]);
  });

  it("gives each token its own request, so two forms open at once each make one", async () => {
    await asStudent();
    await send();
    await send();
    expect(mine()).toHaveLength(2);
  });

  it("refuses a form with no token, a made-up one, a badly shaped one or one that has run out, keeping what was typed", async () => {
    await asStudent();
    const old = (await issueOnceToken())!;
    vi.setSystemTime(new Date(STAFF_NOW.getTime() + ONCE_TTL_MS));
    for (const once of ["", FORGED, "x".repeat(100_000), old]) {
      const redirect = await send({ once });
      expect([redirect.url, redirect.type, request.refreshed], once.slice(0, 12)).toEqual([
        "/looking-for/new",
        "replace",
        false,
      ]);
      expect(await readFormState(requestFormKey(null)), once.slice(0, 12)).toMatchObject({
        errors: ["form-expired"],
        values: { title: "Desk lamp for res", details: FORM.details, budget: "R150", neededBy: "2026-10-20" },
        notice: null,
      });
    }
    expect(mine()).toHaveLength(0);
    expect(request.updatedTags).toEqual([]);
  });

  it("refuses another browser's token", async () => {
    await asStudent();
    const once = (await issueOnceToken())!;
    await signedInAs(request, "acc-mentor");
    expect((await send({ once })).url).toBe("/looking-for/new");
    expect((await readFormState(requestFormKey(null)))?.errors).toEqual(["form-expired"]);
    expect([...sampleStore().requests.values()].some((row) => row.askerId === "acc-mentor")).toBe(false);
  });

  it("keeps the token through a post that fails its checks", async () => {
    await asStudent();
    const once = (await issueOnceToken())!;
    await send({ once, title: "Lamp" });
    expect((await readFormState(requestFormKey(null)))?.errors).toEqual(["title-length"]);
    expect(mine()).toHaveLength(0);
    expect((await send({ once })).url).toMatch(/^\/looking-for\/r-/);
    expect(mine()).toHaveLength(1);
  });

  it("needs no token to edit a request, and ignores one", async () => {
    await asStudent();
    const { id } = await posted();
    const redirect = await redirectSignalOf(() =>
      saveMyRequest(form({ ...FORM, request: id, title: "Clip-on desk lamp", once: FORGED })),
    );
    expect(redirect.url).toBe(`/looking-for/${id}`);
    expect((await getOwnRequest("acc-student", id))?.request.title).toBe("Clip-on desk lamp");
  });
});

describe("Save changes (spec 2.6, plan decision 6)", () => {
  it("edits the asker's open request and says so on its page", async () => {
    await asStudent();
    const { id } = await posted();
    expect(await redirectOf(() => saveMyRequest(form({ ...FORM, request: id, title: "Clip-on desk lamp" })))).toBe(
      `/looking-for/${id}`,
    );
    expect((await getOwnRequest("acc-student", id))?.request.title).toBe("Clip-on desk lamp");
    expect(await readFormState(requestNoteKey(id))).toMatchObject({ notice: "saved" });
  });

  // Review of Tasks 6 to 15 (plan amendment 19.6): a request can be edited after its needed-by date has gone by.
  it("saves an edit that leaves a passed needed-by date as it is, and refuses a changed date that has passed", async () => {
    await asStudent();
    const { id } = await createRequest({
      askerId: "acc-student",
      fields: { ...FIELDS, neededBy: "2026-10-10" },
      now: STAFF_NOW,
    });
    expect(
      await redirectOf(() =>
        saveMyRequest(form({ ...FORM, request: id, title: "Clip-on desk lamp", neededBy: "2026-10-10" })),
      ),
    ).toBe(`/looking-for/${id}`);
    expect((await getOwnRequest("acc-student", id))?.request).toMatchObject({
      title: "Clip-on desk lamp",
      neededBy: "2026-10-10",
    });
    expect(await redirectOf(() => saveMyRequest(form({ ...FORM, request: id, neededBy: "2026-10-11" })))).toBe(
      `/looking-for/${id}/edit`,
    );
    expect((await readFormState(requestFormKey(id)))?.errors).toEqual(["needed-past"]);
    expect((await getOwnRequest("acc-student", id))?.request.neededBy).toBe("2026-10-10");
  });

  it("never edits someone else's request, a sample, or a closed one", async () => {
    await asStudent();
    const theirs = await posted("acc-mentor");
    expect(await redirectOf(() => saveMyRequest(form({ ...FORM, request: theirs.id, title: "Mine now" })))).toBe(
      "/account/requests",
    );
    expect(await redirectOf(() => saveMyRequest(form({ ...FORM, request: "r-001" })))).toBe("/account/requests");
    const mine = await posted();
    sampleStore().requests.get(mine.id)!.status = "closed";
    expect(await redirectOf(() => saveMyRequest(form({ ...FORM, request: mine.id, title: "Changed" })))).toBe(
      `/looking-for/${mine.id}/edit`,
    );
    expect((await getOwnRequest("acc-mentor", theirs.id))?.request.title).toBe("Desk lamp for res");
    expect((await getOwnRequest("acc-student", mine.id))?.request.title).toBe("Desk lamp for res");
  });
});

describe("Close, Reopen and Delete (spec 2.6, plan decisions 6 and 7)", () => {
  it("closes from the request's page and reopens from Your requests, with a status line where it lands", async () => {
    await asStudent();
    const { id } = await posted();
    expect(await redirectOf(() => closeMyRequest(form({ request: id })))).toBe(`/looking-for/${id}`);
    expect((await getOwnRequest("acc-student", id))?.state).toBe("closed");
    expect(await readFormState(requestNoteKey(id))).toMatchObject({ notice: "closed" });
    expect(request.updatedTags).toEqual(["requests"]);
    expect(await redirectOf(() => reopenMyRequest(form({ request: id, from: "list" })))).toBe("/account/requests");
    expect((await getOwnRequest("acc-student", id))?.state).toBe("open");
    expect(await readFormState(YOUR_REQUESTS_FORM)).toMatchObject({ notice: "reopened" });
  });

  it("won't reopen a sixth open request", async () => {
    await asStudent();
    const closed = await posted();
    sampleStore().requests.get(closed.id)!.status = "closed";
    for (let n = 0; n < 5; n += 1) await posted();
    await redirectOf(() => reopenMyRequest(form({ request: closed.id })));
    expect((await getOwnRequest("acc-student", closed.id))?.state).toBe("closed");
    expect(await readFormState(requestNoteKey(closed.id))).toMatchObject({ notice: "reopen-limit" });
  });

  it("changes nothing on someone else's request, and says nothing", async () => {
    await asStudent();
    const theirs = await posted("acc-mentor");
    await redirectOf(() => closeMyRequest(form({ request: theirs.id })));
    expect((await getOwnRequest("acc-mentor", theirs.id))?.state).toBe("open");
    expect(await readFormState(requestNoteKey(theirs.id))).toBeNull();
    expect(request.updatedTags).toEqual([]);
  });

  it("deletes from the confirm page, landing on Your requests; never someone else's", async () => {
    await asStudent();
    const { id } = await posted();
    expect(await redirectOf(() => deleteMyRequest(form({ request: id })))).toBe("/account/requests");
    expect(sampleStore().requests.has(id)).toBe(false);
    expect(await readFormState(YOUR_REQUESTS_FORM)).toMatchObject({ notice: "deleted" });
    const theirs = await posted("acc-mentor");
    await redirectOf(() => deleteMyRequest(form({ request: theirs.id })));
    expect(sampleStore().requests.has(theirs.id)).toBe(true);
  });
});

describe("Send offer (community actions spec 2.7 to 2.9)", () => {
  const asSeller = () => signedInAs(request, "acc-seller");

  it("starts the thread, expires the board, and opens the thread with Sent.", async () => {
    const { id } = await posted();
    await asSeller();
    const redirect = await redirectSignalOf(() =>
      sendOffer(form({ request: id, body: "I have a clip-on lamp, R120.", listing: "l-001" })),
    );
    expect(redirect.url).toMatch(/^\/messages\/conv-[0-9a-f-]{36}$/);
    expect([redirect.type, request.refreshed, request.updatedTags]).toEqual(["replace", true, ["requests"]]);
    const conversationId = redirect.url.split("/").at(-1)!;
    expect(sampleStore().conversations.get(conversationId)).toMatchObject({
      status: "offered",
      buyerId: "acc-student",
      sellerSlug: "tech-corner",
      requestId: id,
      listingId: "l-001",
    });
    expect(await readFormState(sentNoteKey(conversationId))).toMatchObject({ notice: "sent" });
    expect(await readFormState(offerFormKey(id))).toBeNull();
    expect((await getOwnRequest("acc-student", id))?.request.offers).toBe(1);
  });

  it("ignores a listing that isn't one of the shop's listed ones (plan decision 13)", async () => {
    const { id } = await posted();
    await asSeller();
    const url = await redirectOf(() => sendOffer(form({ request: id, body: "I can help.", listing: "l-004" })));
    expect(sampleStore().conversations.get(url.split("/").at(-1)!)?.listingId).toBeNull();
  });

  it("keeps the message and says what's wrong, or asks to check scam words before sending anyway", async () => {
    const { id } = await posted();
    await asSeller();
    expect(await redirectOf(() => sendOffer(form({ request: id, body: " " })))).toBe(`/looking-for/${id}/offer`);
    expect(await readFormState(offerFormKey(id))).toMatchObject({ errors: ["message-missing"] });
    const scam = "Pay a deposit first and I'll bring it.";
    await redirectOf(() => sendOffer(form({ request: id, body: scam })));
    expect(await readFormState(offerFormKey(id))).toMatchObject({ notice: "check", values: { body: scam } });
    expect(sampleStore().conversations.size).toBe(2);
    await redirectOf(() => sendOffer(form({ request: id, body: scam, anyway: "yes" })));
    expect(sampleStore().conversations.size).toBe(3);
  });

  it("stops at 20 offers a shop in a day", async () => {
    const { id } = await posted();
    for (let n = 0; n < 20; n += 1) {
      const other = await posted("acc-mentor");
      await startOffer({
        askerId: "acc-mentor",
        request: { id: other.id, title: other.title },
        sellerSlug: "tech-corner",
        listing: null,
        body: "I can help.",
        now: STAFF_NOW,
      });
    }
    await asSeller();
    await redirectOf(() => sendOffer(form({ request: id, body: "I can help." })));
    expect((await readFormState(offerFormKey(id)))?.errors).toEqual(["offer-rate"]);
  });

  it("makes one thread with one message when the same offer is sent twice at once (plan amendment 7)", async () => {
    const { id } = await posted();
    await asSeller();
    const send = () => redirectOf(() => sendOffer(form({ request: id, body: "I can help." })));
    await Promise.all([send(), send()]);
    const threads = [...sampleStore().conversations.values()].filter((row) => row.requestId === id);
    expect(threads).toHaveLength(1);
    const said = [...sampleStore().messages.values()].filter((message) => message.conversationId === threads[0].id);
    expect(said).toHaveLength(1);
    expect((await getOwnRequest("acc-student", id))?.request.offers).toBe(1);
  });

  it("sends anyone who can't offer back to the composer, which says why, storing nothing", async () => {
    const { id } = await posted();
    await signedInAs(request, "acc-mentor");
    expect(await redirectOf(() => sendOffer(form({ request: id, body: "I can help." })))).toBe(`/looking-for/${id}/offer`);
    await asStudent();
    expect(await redirectOf(() => sendOffer(form({ request: id, body: "Me!" })))).toBe(`/looking-for/${id}/offer`);
    expect(sampleStore().conversations.size).toBe(2);
    expect(await redirectOf(() => sendOffer(form({ request: "Not an id!", body: "x" })))).toBe("/looking-for");
  });
});
