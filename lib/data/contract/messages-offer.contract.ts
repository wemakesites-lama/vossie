import { afterEach, beforeEach, expect, it } from "vitest";
import { getInbox, startOffer } from "@/lib/data/messages";
import { offerNoteText, UNNAMED_ASKER } from "@/lib/looking-for/words";
import { threadPath } from "@/lib/messaging/paths";
import type { World } from "@/tests/contract/world";

// A shop's offer on a Looking For request in both backends (C2/C3 plan Task 16, decision 23 and amendment 6; community
// actions spec 2.7 to 2.11): one thread per shop and request, the asker told, the asker's inbox, and the asker unnamed to
// the shop until they write. The rest of offers (findOffer, offersForRequest, countOffersSince) is C4's.
// messages-offer.test.ts runs it on the sample store, messages-offer.db.test.ts on the local stack.

const SHOP = "Contract corner";
const TITLE = "Contract wanted: a kettle";

export function messagesOfferContract(makeWorld: () => World): void {
  let world: World;
  let slug: string;
  let request: { id: string; title: string };
  beforeEach(async () => {
    world = makeWorld();
    await world.tidySelling("seller");
    await world.tidyMessaging();
    slug = await world.openShop("seller", { name: SHOP });
    request = { id: await world.addRequest({ asker: "asker", title: TITLE, neededBy: null }), title: TITLE };
  });
  afterEach(async () => {
    await world.cleanup();
  });

  const offer = async (body = "We have one.\nR90.") => {
    const askerId = await world.signedIn("asker");
    return world.asViewer("seller", () =>
      startOffer({ askerId, request, sellerSlug: slug, listing: null, body, now: new Date() }),
    );
  };

  it("makes one offer thread per shop and request, and tells the asker", async () => {
    const id = await offer();
    expect(id).toEqual(expect.any(String));
    expect(await offer("Still have it.")).toBe(id);
    expect(await world.notificationsOf("asker")).toEqual([
      { kind: "offer", subjectId: id, text: offerNoteText(SHOP, TITLE), href: threadPath(id) },
    ]);
  });

  it("shows the asker the offer, and the shop an unnamed asker until they write", async () => {
    const id = await offer();
    const asker = await world.asViewer("asker", (accountId) => getInbox(accountId, "buying", new Date()));
    expect(asker).toEqual([
      expect.objectContaining({
        id,
        role: "buyer",
        otherName: SHOP,
        listingTitle: null,
        requestTitle: TITLE,
        preview: "We have one.",
        lastFromViewer: false,
        status: "offered",
        unread: true,
      }),
    ]);
    const shop = await world.asViewer("seller", (accountId) => getInbox(accountId, "selling", new Date()));
    expect(shop).toEqual([expect.objectContaining({ id, otherName: UNNAMED_ASKER, status: "offered", lastFromViewer: true })]);
  });
}
