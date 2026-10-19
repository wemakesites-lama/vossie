import { beforeEach, describe, expect, it } from "vitest";
import { startOffer } from "@/lib/data/messages";
import { createRequest, hideRequest } from "@/lib/data/requests";
import { resetSampleStore } from "@/lib/data/store";
import type { Account } from "@/lib/types";
import type { RequestFields } from "./rules";
import { offerStatus, offerSubject } from "./subjects";

const NOW = new Date("2026-10-14T08:42:00.000Z");

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
    const status = await offerStatus(subject, TECH_CORNER);
    expect(status).toMatchObject({ kind: "open", askerId: "acc-student", shopSlug: "tech-corner" });
    expect(status.kind === "open" ? status.listings.map((listing) => listing.id).sort() : []).toEqual(["l-001", "l-007"]);
  });

  it("says why anyone else can't: the asker, no shop, a shop waiting for approval, a paused shop", async () => {
    const subject = await postedSubject();
    expect(await offerStatus(subject, viewer("acc-student", null))).toEqual({ kind: "own" });
    expect(await offerStatus(subject, viewer("acc-mentor", null))).toEqual({ kind: "no-shop" });
    expect(await offerStatus(subject, viewer("acc-pending", { status: "pending", sellerSlug: null }))).toEqual({
      kind: "pending",
    });
    expect(await offerStatus(subject, viewer("acc-seller", { status: "paused", sellerSlug: "tech-corner" }))).toEqual({
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
    expect(await offerStatus(subject, TECH_CORNER)).toEqual({ kind: "offered", conversationId });
    expect(await offerStatus((await offerSubject("r-015"))!, TECH_CORNER)).toEqual({ kind: "closed" });
    expect(await offerStatus((await offerSubject("r-002"))!, TECH_CORNER)).toEqual({ kind: "sample" });
  });

  it("has no subject for a hidden or unknown request: the composer is the 404", async () => {
    await hideRequest("r-001", "Not allowed.", NOW);
    expect(await offerSubject("r-001")).toBeNull();
    expect(await offerSubject("r-nope")).toBeNull();
  });
});
