import { beforeEach, describe, expect, it } from "vitest";
import type { RequestFields } from "@/lib/looking-for/rules";
import { getNotifications, notify } from "./notifications";
import {
  countOpenRequests,
  countRequestsSince,
  createRequest,
  deleteRequest,
  exportRequests,
  forgetRequestsOf,
  getOwnRequest,
  hideRequest,
  listedRequests,
  listOwnRequests,
  publicRequest,
  publicRequestIds,
  requestAskerId,
  setRequestOpen,
  updateRequest,
} from "./requests";
import { resetSampleStore, sampleStore } from "./store";

const NOW = new Date("2026-10-14T08:42:00.000Z");
const later = (minutes: number) => new Date(NOW.getTime() + minutes * 60_000);

const FIELDS: RequestFields = {
  title: "Desk lamp for res",
  categorySlug: "res-living",
  campusSlug: "midrand",
  details: "A lamp that clips onto a desk, by the weekend.",
  budgetZar: 150,
  swapWelcome: false,
  neededBy: null,
};

const post = (askerId = "acc-student", now = NOW, fields: RequestFields = FIELDS) =>
  createRequest({ askerId, fields, now });

beforeEach(() => {
  resetSampleStore();
});

describe("reading requests (community actions plan decision 1)", () => {
  it("gives the samples back as part B made them, offers included", () => {
    expect(publicRequest("r-001")).toMatchObject({
      id: "r-001",
      title: "Accounting 1 tutor this week",
      offers: 2,
      status: "open",
    });
    expect(listedRequests()).toHaveLength(14);
    expect(publicRequest("r-015")?.status).toBe("closed");
    expect(publicRequestIds()).toHaveLength(16);
  });

  it("counts offer threads on top of the sample's number (spec 2.11)", () => {
    const { conversations } = sampleStore();
    const offer = { ...structuredClone(conversations.get("conv-s1")!), id: "conv-offer", requestId: "r-001" };
    conversations.set(offer.id, offer);
    expect(publicRequest("r-001")?.offers).toBe(3);
  });

  it("leaves a hidden request out of every list, and gives it no page", async () => {
    await hideRequest("r-001", "Not allowed on Vossie.", NOW);
    expect(publicRequest("r-001")).toBeNull();
    expect(listedRequests().map((request) => request.id)).not.toContain("r-001");
    expect(publicRequestIds()).not.toContain("r-001");
  });
});

describe("the asker's own requests (spec 2.3, 2.6 and 2.13)", () => {
  it("posts an open request with a new id and no sample offers, on the board straight away", async () => {
    const posted = await post();
    expect(posted.id).toMatch(/^r-[0-9a-f-]{36}$/);
    expect(posted).toMatchObject({ ...FIELDS, offers: 0, status: "open", createdAt: NOW.toISOString() });
    expect(listedRequests().map((request) => request.id)).toContain(posted.id);
    expect(sampleStore().requests.get(posted.id)?.askerId).toBe("acc-student");
  });

  it("is the asker's alone: anyone else gets nothing and changes nothing", async () => {
    const { id } = await post();
    expect(await getOwnRequest("acc-student", id)).toMatchObject({ state: "open", hiddenReason: null });
    expect(await getOwnRequest("acc-mentor", id)).toBeNull();
    expect(await getOwnRequest("acc-student", "r-001")).toBeNull();
    expect(await updateRequest("acc-mentor", id, { ...FIELDS, title: "Mine now" }, NOW)).toBeNull();
    expect(await setRequestOpen("acc-mentor", id, false, NOW)).toBeNull();
    expect(await deleteRequest("acc-mentor", id)).toBe(false);
    expect(publicRequest(id)?.title).toBe("Desk lamp for res");
  });

  it("edits only while open, and closes and reopens (spec 2.6)", async () => {
    const { id } = await post();
    expect(await updateRequest("acc-student", id, { ...FIELDS, title: "Clip-on desk lamp" }, later(5))).toMatchObject({
      title: "Clip-on desk lamp",
    });
    expect(await setRequestOpen("acc-student", id, false, later(10))).toMatchObject({ status: "closed" });
    expect(sampleStore().requests.get(id)?.closedAt).toBe(later(10).toISOString());
    expect(listedRequests().map((request) => request.id)).not.toContain(id);
    expect(publicRequest(id)?.status).toBe("closed");
    expect(await setRequestOpen("acc-student", id, false, later(11))).toBeNull();
    expect(await updateRequest("acc-student", id, FIELDS, later(12))).toBeNull();
    expect(await setRequestOpen("acc-student", id, true, later(13))).toMatchObject({ status: "open" });
    expect(sampleStore().requests.get(id)?.closedAt).toBeNull();
  });

  it("deletes it: its page goes, and so does the Hub's notification about it", async () => {
    const { id } = await post();
    await notify({ accountId: "acc-student", kind: "request-update", subjectId: id, text: "Hid it.", href: "/", now: NOW });
    expect(await deleteRequest("acc-student", id)).toBe(true);
    expect(publicRequest(id)).toBeNull();
    expect((await getNotifications("acc-student", 50)).map((item) => item.text)).not.toContain("Hid it.");
  });

  it("lists Your requests: open, then closed, then hidden, each newest first (plan decision 18)", async () => {
    const first = await post("acc-student", later(1));
    const second = await post("acc-student", later(2));
    const third = await post("acc-student", later(3));
    const fourth = await post("acc-student", later(4));
    await setRequestOpen("acc-student", first.id, false, later(5));
    await hideRequest(second.id, "Spam.", later(6));
    const own = await listOwnRequests("acc-student");
    expect(own.map((item) => [item.request.id, item.state])).toEqual([
      [fourth.id, "open"],
      [third.id, "open"],
      [first.id, "closed"],
      [second.id, "hidden"],
    ]);
    expect(own[3].hiddenReason).toBe("Spam.");
  });

  it("counts open ones, and the last 24 hours' posts, for the limits (plan decision 4)", async () => {
    const old = await post("acc-student", new Date("2026-10-13T08:00:00.000Z"));
    await post("acc-student", later(1));
    const closed = await post("acc-student", later(2));
    await setRequestOpen("acc-student", closed.id, false, later(3));
    expect(await countOpenRequests("acc-student")).toBe(2);
    expect(await countRequestsSince("acc-student", new Date(later(3).getTime() - 24 * 60 * 60 * 1000))).toBe(2);
    await hideRequest(old.id, "Spam.", later(4));
    expect(await countOpenRequests("acc-student")).toBe(1);
    expect(await countOpenRequests("acc-mentor")).toBe(0);
  });
});

describe("the Hub hiding a request (spec 2.14)", () => {
  it("hides it once, with its reason, and says who asked; the asker can delete it, not close it", async () => {
    const { id } = await post();
    expect(await hideRequest(id, "Selling exam answers.", later(1))).toEqual({
      id,
      title: "Desk lamp for res",
      askerId: "acc-student",
    });
    expect(await hideRequest(id, "Again.", later(2))).toBeNull();
    expect(await hideRequest("r-nope", "No.", later(2))).toBeNull();
    expect(await setRequestOpen("acc-student", id, false, later(3))).toBeNull();
    expect(await getOwnRequest("acc-student", id)).toMatchObject({ state: "hidden", hiddenReason: "Selling exam answers." });
    expect(await deleteRequest("acc-student", id)).toBe(true);
  });

  it("hides a sample request, which has no asker", async () => {
    expect(await hideRequest("r-002", "Not allowed.", NOW)).toEqual({
      id: "r-002",
      title: "Graphic calculator to borrow for exams",
      askerId: null,
    });
  });
});

describe("deleting an account, and its data export (spec 2.23, plan decision 21)", () => {
  it("removes only that account's requests", async () => {
    await post("acc-student");
    await post("acc-mentor");
    await forgetRequestsOf("acc-student");
    expect(await listOwnRequests("acc-student")).toEqual([]);
    expect(await listOwnRequests("acc-mentor")).toHaveLength(1);
    expect(sampleStore().requests.size).toBe(17);
  });

  it("exports the account's requests by name, with no ids", async () => {
    const { id } = await post("acc-student", NOW, { ...FIELDS, neededBy: "2026-10-20" });
    await setRequestOpen("acc-student", id, false, later(1));
    expect(await exportRequests("acc-student")).toEqual([
      {
        title: "Desk lamp for res",
        category: "Res & living",
        campus: "Midrand",
        details: "A lamp that clips onto a desk, by the weekend.",
        budgetZar: 150,
        swapWelcome: false,
        neededBy: "2026-10-20",
        state: "closed",
        hubReason: null,
        postedAt: NOW.toISOString(),
        closedAt: later(1).toISOString(),
        offers: 0,
      },
    ]);
    expect(await exportRequests("acc-mentor")).toEqual([]);
  });
});

describe("who asked (community actions spec 2.7 and 2.11)", () => {
  it("is the account that posted it; no one for a sample request or one that's gone", async () => {
    const { id } = await post();
    expect(await requestAskerId(id)).toBe("acc-student");
    expect(await requestAskerId("r-001")).toBeNull();
    expect(await requestAskerId("r-nope")).toBeNull();
  });
});
