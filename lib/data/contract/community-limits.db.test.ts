import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { addFollow } from "@/lib/data/follows";
import { startOffer } from "@/lib/data/messages";
import { refusalOf } from "@/lib/data/refused";
import { createRequest } from "@/lib/data/requests";
import { FOLLOW_LIMIT } from "@/lib/following/rules";
import { OFFERS_PER_DAY, OPEN_REQUESTS_MAX, type RequestFields } from "@/lib/looking-for/rules";
import { supabaseWorld, type SupabaseWorld } from "@/tests/db/supabase-world";

// C4's limits under concurrency on the local stack (C4 review fix 2; the pattern of C3's limits.db.test.ts): the
// TypeScript counts only shape the form's errors, and the database's own count, under the account's (or the shop's)
// advisory lock, is what holds when two posts arrive at once. Each case puts the account one short of a limit, then
// sends two at once: exactly one lands and the other gets the limit's refusal, and nothing else is written.
vi.mock("@/lib/data/supabase/clients", async (original) => (await import("@/tests/db/viewer")).withViewerSeam(await original()));

const FIELDS: RequestFields = {
  title: "A contract desk lamp",
  categorySlug: "tech",
  campusSlug: "pretoria",
  details: "A lamp that clips onto a desk, for the contract tests.",
  budgetZar: 150,
  swapWelcome: true,
  neededBy: null,
};

describe("C4's limits when two posts arrive at once (C4 review fix 2)", () => {
  let world: SupabaseWorld;
  let asker: string;
  beforeEach(async () => {
    world = supabaseWorld();
    await world.tidyCommunity();
    for (const owner of ["shopper", "seller"] as const) await world.tidySelling(owner);
    await world.tidyMessaging();
    asker = await world.signedIn("asker");
  });
  afterEach(async () => {
    await world.cleanup();
  });

  /** A fresh one-time token in the asker's session (save_request takes it: C4/C5 plan decision 6). */
  const token = async () => {
    const value = randomUUID();
    await world.onceRow("asker", `staff-once:${value}`);
    return value;
  };
  const post = (onceToken: string, title: string) =>
    refusalOf(createRequest({ askerId: asker, fields: { ...FIELDS, title }, now: new Date(), onceToken }));
  const requestsOf = async (account: string) => {
    const { count, error } = await world.admin.from("requests").select("id", { count: "exact", head: true }).eq("asker_id", account);
    if (error) throw new Error(error.message);
    return count;
  };

  it("posts exactly one of two new requests at 4 open; the other is open-limit", async () => {
    for (let n = 1; n < OPEN_REQUESTS_MAX; n += 1) {
      await world.addRequest({ asker: "asker", title: `A contract open ${n}`, neededBy: null });
    }
    const [first, second] = [await token(), await token()];
    const results = await world.asViewer("asker", () =>
      Promise.all([post(first, "A contract fifth"), post(second, "A contract sixth")]),
    );
    expect(results).toEqual(expect.arrayContaining([{ ok: expect.objectContaining({ id: expect.any(String) }) }, { refused: "open-limit" }]));
    expect(results).toHaveLength(2);
    expect(await requestsOf(asker)).toBe(OPEN_REQUESTS_MAX);
  });

  it("posts one request for the same token sent twice at once; the other is once-taken", async () => {
    const once = await token();
    const results = await world.asViewer("asker", () => Promise.all([post(once, "A contract lamp"), post(once, "A contract lamp")]));
    expect(results).toEqual(expect.arrayContaining([{ ok: expect.objectContaining({ id: expect.any(String) }) }, { refused: "once-taken" }]));
    expect(results).toHaveLength(2);
    expect(await requestsOf(asker)).toBe(1);
  });

  it("follows exactly one of two shops followed at once at 199 follows; the other is limit", async () => {
    const lamps = await world.openShop("shopper", { name: "Contract lamps" });
    const kettles = await world.openShop("seller", { name: "Contract kettles" });
    await world.fillFollows("asker", FOLLOW_LIMIT - 1);
    const results = await world.asViewer("asker", () =>
      Promise.all([addFollow(asker, lamps, new Date()), addFollow(asker, kettles, new Date())]),
    );
    expect(results).toEqual(expect.arrayContaining(["followed", "limit"]));
    expect(results).toHaveLength(2);
    const { count, error } = await world.admin.from("follows").select("id", { count: "exact", head: true }).eq("account_id", asker);
    if (error) throw new Error(error.message);
    expect(count).toBe(FOLLOW_LIMIT);
  });

  it("starts exactly one of two offers sent at once by a shop at 19 offers that day; the other is offer-rate", async () => {
    const slug = await world.openShop("seller", { name: "Contract lamps" });
    // 19 offers today, each on a request of its own (one offer thread per shop and request), with no message, so the
    // hour's message limit stays out of it.
    for (let n = 1; n < OFFERS_PER_DAY; n += 1) {
      const request = await world.addRequest({ asker: "asker", title: `A contract offered ${n}`, neededBy: null });
      await world.addConversation({ buyer: "asker", slug, offerOn: request, messages: [] });
    }
    const requests = [
      { id: await world.addRequest({ asker: "asker", title: "A contract twentieth", neededBy: null }), title: "A contract twentieth" },
      { id: await world.addRequest({ asker: "asker", title: "A contract twenty-first", neededBy: null }), title: "A contract twenty-first" },
    ];
    const results = await world.asViewer("seller", () =>
      Promise.all(
        requests.map((request) =>
          refusalOf(startOffer({ askerId: asker, request, sellerSlug: slug, listing: null, body: "I have one, R120.", now: new Date() })),
        ),
      ),
    );
    expect(results).toEqual(expect.arrayContaining([{ ok: expect.any(String) }, { refused: "offer-rate" }]));
    expect(results).toHaveLength(2);
    const shop = await world.admin.from("shops").select("id").eq("slug", slug).single();
    if (shop.error) throw new Error(shop.error.message);
    const { count, error } = await world.admin
      .from("conversations")
      .select("id", { count: "exact", head: true })
      .eq("shop_id", shop.data.id)
      .eq("is_offer", true);
    if (error) throw new Error(error.message);
    expect(count).toBe(OFFERS_PER_DAY);
  });
});
