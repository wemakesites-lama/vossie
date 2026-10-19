import { beforeEach, describe, expect, it } from "vitest";
import { forgetAccountInMessaging, sendMessage, startOffer, type NewOffer } from "./messages";
import { countOffersSince, findOffer, offersForRequest } from "./offers";
import { resetSampleStore } from "./store";

const at = (hour: number) => new Date(`2026-10-14T${String(hour).padStart(2, "0")}:00:00.000Z`);

const offer = (overrides: Partial<NewOffer> = {}) =>
  startOffer({
    askerId: "acc-student",
    request: { id: "r-001", title: "Accounting 1 tutor this week" },
    sellerSlug: "tech-corner",
    listing: null,
    body: "I passed Accounting 1 with 78%.\nEvenings work for me.",
    now: at(8),
    ...overrides,
  });

beforeEach(() => {
  resetSampleStore();
});

describe("offers on a request (community actions spec 2.9 and 2.13)", () => {
  it("finds a shop's offer on a request, while the shop is there to answer it", async () => {
    const id = await offer();
    expect(await findOffer("r-001", "tech-corner")).toBe(id);
    expect(await findOffer("r-001", "code-coach")).toBeNull();
    expect(await findOffer("r-002", "tech-corner")).toBeNull();
    await forgetAccountInMessaging("acc-seller", "tech-corner");
    expect(await findOffer("r-001", "tech-corner")).toBeNull();
  });

  it("lists them for the asker, newest first, with the shop, the offer's first line and when", async () => {
    const first = await offer({ now: at(8) });
    const second = await offer({ sellerSlug: "code-coach", body: "Two past papers, R250.", now: at(9) });
    expect(await offersForRequest("r-001")).toEqual([
      { conversationId: second, shopName: "Code coach", preview: "Two past papers, R250.", offeredAt: at(9).toISOString() },
      {
        conversationId: first,
        shopName: "Tech corner",
        preview: "I passed Accounting 1 with 78%.",
        offeredAt: at(8).toISOString(),
      },
    ]);
    expect(await offersForRequest("r-002")).toEqual([]);
  });

  it("counts a shop's offers since a time, for the daily limit (plan decision 4)", async () => {
    await offer({ request: { id: "r-001", title: "Accounting 1 tutor this week" }, now: at(6) });
    await offer({ request: { id: "r-003", title: "Birthday cake for Friday" }, now: at(9) });
    expect(await countOffersSince("tech-corner", at(7))).toBe(1);
    expect(await countOffersSince("tech-corner", at(5))).toBe(2);
    expect(await countOffersSince("code-coach", at(5))).toBe(0);
  });

  // Amendment 9: the asker still sees the offer, as "A closed shop", but a shop that has gone is nobody's 20 a day.
  it("keeps an offer from a shop that has gone in the asker's list, but not in that shop's daily count", async () => {
    const id = await offer({ now: at(8) });
    // The asker answers, so the thread outlives the shop's owner (messaging plan decision 14).
    await sendMessage({ conversationId: id, accountId: "acc-student", body: "Yes please.", now: at(9) });
    await forgetAccountInMessaging("acc-seller", "tech-corner");
    expect(await offersForRequest("r-001")).toEqual([
      { conversationId: id, shopName: "A closed shop", preview: "", offeredAt: at(8).toISOString() },
    ]);
    expect(await countOffersSince("tech-corner", at(5))).toBe(0);
  });
});
