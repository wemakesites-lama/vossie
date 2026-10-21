import { beforeEach, describe, expect, it } from "vitest";
import { startOffer } from "@/lib/data/messages";
import { createRequest, hideRequest } from "@/lib/data/requests";
import { resetSampleStore } from "@/lib/data/store";
import type { Account } from "@/lib/types";
import type { RequestFields } from "./rules";
import { offerStatus, offerSubject } from "./subjects";

const NOW = new Date("2026-10-14T08:42:00.000Z");
const TODAY = "2026-10-14";

const FIELDS: RequestFields = {
  title: "Desk lamp for res",
  categorySlug: "res-living",
  campusSlug: "midrand",
  details: "A lamp that clips onto a desk, by the weekend.",
  budgetZar: 150,
  swapWelcome: false,
  neededBy: null,
};

const viewer = (id: string, seller: Account["seller"]) => ({ id, seller });
const TECH_CORNER = viewer("acc-seller", { status: "approved", sellerSlug: "tech-corner" });

const postedSubject = async () => {
  const posted = await createRequest({ askerId: "acc-student", fields: FIELDS, now: NOW });
  return (await offerSubject(posted.id))!;
};

beforeEach(() => {
  resetSampleStore();
});

describe("who can offer (community actions spec 2.8, plan decisions 12 and 13)", () => {
  it("lets an approved shop offer on someone's open request, with its listed listings to point to", async () => {
    const subject = await postedSubject();
    expect(subject.campusName).toBe("Midrand");
    const status = await offerStatus(subject, TECH_CORNER, TODAY);
    expect(status).toMatchObject({ kind: "open", askerId: "acc-student", shopSlug: "tech-corner" });
    expect(status.kind === "open" ? status.listings.map((listing) => listing.id).sort() : []).toEqual(["l-001", "l-007"]);
  });

  it("takes no offers on a request's closing day, settled or not (stage L spec decision 14)", async () => {
    const posted = await createRequest({ askerId: "acc-student", fields: { ...FIELDS, neededBy: "2026-10-16" }, now: NOW });
    const subject = (await offerSubject(posted.id))!;
    expect((await offerStatus(subject, TECH_CORNER, "2026-10-19")).kind).toBe("open");
    expect(await offerStatus(subject, TECH_CORNER, "2026-10-20")).toEqual({ kind: "closed" });
  });

  it("says why anyone else can't: the asker, no shop, a shop waiting for approval, a paused shop", async () => {
    const subject = await postedSubject();
    expect(await offerStatus(subject, viewer("acc-student", null), TODAY)).toEqual({ kind: "own" });
    expect(await offerStatus(subject, viewer("acc-mentor", null), TODAY)).toEqual({ kind: "no-shop" });
    expect(await offerStatus(subject, viewer("acc-pending", { status: "pending", sellerSlug: null }), TODAY)).toEqual({
      kind: "pending",
    });
    expect(await offerStatus(subject, viewer("acc-seller", { status: "paused", sellerSlug: "tech-corner" }), TODAY)).toEqual({
      kind: "paused",
    });
  });

  it("says when the shop has offered already, the request is closed, or it's a sample", async () => {
    const subject = await postedSubject();
    const conversationId = await startOffer({
      askerId: "acc-student",
      request: { id: subject.request.id, title: subject.request.title },
      sellerSlug: "tech-corner",
      listing: null,
      body: "I can help.",
      now: NOW,
    });
    expect(await offerStatus(subject, TECH_CORNER, TODAY)).toEqual({ kind: "offered", conversationId });
    expect(await offerStatus((await offerSubject("r-015"))!, TECH_CORNER, TODAY)).toEqual({ kind: "closed" });
    expect(await offerStatus((await offerSubject("r-002"))!, TECH_CORNER, TODAY)).toEqual({ kind: "sample" });
  });

  // Review of Tasks 6 to 15 (plan amendment 19.7): the offer a shop made stays reachable whatever has happened to the shop.
  it("shows a paused shop the offer it already made, and only otherwise that it is paused", async () => {
    const subject = await postedSubject();
    const paused = viewer("acc-seller", { status: "paused", sellerSlug: "tech-corner" });
    expect(await offerStatus(subject, paused, TODAY)).toEqual({ kind: "paused" });
    const conversationId = await startOffer({
      askerId: "acc-student",
      request: { id: subject.request.id, title: subject.request.title },
      sellerSlug: "tech-corner",
      listing: null,
      body: "I can help.",
      now: NOW,
    });
    expect(await offerStatus(subject, paused, TODAY)).toEqual({ kind: "offered", conversationId });
    // A shop waiting for approval has no link yet, so it can have made no offer.
    expect(await offerStatus(subject, viewer("acc-pending", { status: "pending", sellerSlug: null }), TODAY)).toEqual({
      kind: "pending",
    });
  });

  it("has no subject for a hidden or unknown request: the composer is the 404", async () => {
    await hideRequest("r-001", "Not allowed.", NOW);
    expect(await offerSubject("r-001")).toBeNull();
    expect(await offerSubject("r-nope")).toBeNull();
  });
});
