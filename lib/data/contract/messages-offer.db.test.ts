import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getInbox, startOffer } from "@/lib/data/messages";
import { isRefused } from "@/lib/data/refused";
import { sastToday } from "@/lib/time";
import { supabaseWorld, type SupabaseWorld } from "@/tests/db/supabase-world";
import { messagesOfferContract } from "./messages-offer.contract";

// A shop's offer on the local stack (C2/C3 plan Task 16, decision 23): the contract, and what only Supabase has:
// start_offer's own refusals as Refused (a request past its closing day, the shop's 20 offers a day), the asker read
// by the database whatever askerId says, and the shop checked against the session (decision 2).
vi.mock("@/lib/data/supabase/clients", async (original) => (await import("@/tests/db/viewer")).withViewerSeam(await original()));

describe("a shop's offer on the local stack (C2/C3 plan Task 16)", () => {
  messagesOfferContract(supabaseWorld);
});

describe("the offer twin on the local stack (C2/C3 plan Task 16)", () => {
  let world: SupabaseWorld;
  let slug: string;
  beforeEach(async () => {
    world = supabaseWorld();
    await world.tidySelling("seller");
    await world.tidySelling("shopper");
    await world.tidyMessaging();
    slug = await world.openShop("seller", { name: "Contract corner" });
  });
  afterEach(async () => {
    await world.cleanup();
  });

  const offerOn = async (requestId: string, { sellerSlug = slug, askerId }: { sellerSlug?: string; askerId?: string } = {}) => {
    const asker = askerId ?? (await world.signedIn("asker"));
    return world.asViewer("seller", () =>
      startOffer({
        askerId: asker,
        request: { id: requestId, title: "Contract wanted" },
        sellerSlug,
        listing: null,
        body: "We have one.",
        now: new Date(),
      }),
    );
  };

  it("throws Refused for a request past its closing day", async () => {
    const days = (n: number) => new Date(Date.parse(`${sastToday()}T12:00:00Z`) + n * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const requestId = await world.addRequest({ asker: "asker", title: "Contract wanted: an old kettle", neededBy: days(-5) });
    const refused = await offerOn(requestId).catch((error: unknown) => error);
    expect(isRefused(refused, "closed")).toBe(true);
  });

  it("throws Refused for the shop's 21st offer in a day, made past the action's own count", async () => {
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    for (let n = 0; n < 20; n += 1) {
      const requestId = await world.addRequest({ asker: "asker", title: `Contract wanted ${n + 1}`, neededBy: null });
      await world.addConversation({
        buyer: "asker",
        slug,
        offerOn: requestId,
        messages: [{ side: "seller", body: "We have one.", sentAt: tenMinutesAgo }],
      });
    }
    const requestId = await world.addRequest({ asker: "asker", title: "Contract wanted: one more", neededBy: null });
    const refused = await offerOn(requestId).catch((error: unknown) => error);
    expect(isRefused(refused, "offer-rate")).toBe(true);
  });

  it("offers to the request's real asker, whatever askerId says", async () => {
    const requestId = await world.addRequest({ asker: "asker", title: "Contract wanted: a kettle", neededBy: null });
    const id = await offerOn(requestId, { askerId: await world.signedIn("shopper") });
    expect((await world.asViewer("asker", (accountId) => getInbox(accountId, "buying", new Date()))).map((row) => row.id)).toEqual([id]);
    expect(await world.asViewer("shopper", (accountId) => getInbox(accountId, "buying", new Date()))).toEqual([]);
  });

  it("throws for a shop that isn't the signed-in account's", async () => {
    const theirs = await world.openShop("shopper");
    const requestId = await world.addRequest({ asker: "asker", title: "Contract wanted: a kettle", neededBy: null });
    await expect(offerOn(requestId, { sellerSlug: theirs })).rejects.toThrow("isn't the signed-in account's");
  });
});
