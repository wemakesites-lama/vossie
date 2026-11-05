import { afterEach, beforeEach, expect, it } from "vitest";
import { coachWeekOf, previousWeek } from "@/lib/coach/week";
import type { CoachAction } from "@/lib/coach/types";
import { exportCoach, readOwnCoachWeeks, saveCoachWeek, settleCoachWeek, tickCoachAction } from "@/lib/data/coach";
import { liveFacts, shopFacts } from "@/lib/data/coach-facts";
import type { World } from "@/tests/contract/world";

// Shop coach's storage and facts (AI stage I1, Task 6), the same in both backends. coach.test.ts runs it on the sample
// store, coach.db.test.ts on the local stack. The viewer's own reads and the tick run asViewer: on Supabase they use the
// viewer's session.

const action = (id: string, asOf: string): CoachAction => ({
  id,
  kind: id.split(":")[0] as CoachAction["kind"],
  target: { type: "post", id: id.split(":")[1] },
  name: "A tip",
  evidence: {},
  href: "/hub/x",
  title: "Read: A tip",
  why: "A short tip.",
  asOf,
});

export function coachContract(makeWorld: () => World): void {
  let world: World;
  let seller: string;
  let slug: string;
  const now = new Date();
  const week = coachWeekOf(now);
  beforeEach(async () => {
    world = makeWorld();
    await world.tidySelling("seller");
    seller = await world.signedIn("seller");
    await world.signedIn("shopper");
    slug = await world.openShop("seller");
  });
  afterEach(async () => {
    await world.cleanup();
  });

  const save = (w: string, actions: CoachAction[]) =>
    saveCoachWeek(slug, { week: w, actions, writtenBy: "fixed", mentorQuestions: null }, now);
  const readAs = (name: "seller" | "shopper", since: string) =>
    world.asViewer(name, (id) => readOwnCoachWeeks(id, slug, since));
  const tickAs = (name: "seller" | "shopper", id: string) =>
    world.asViewer(name, (accountId) => tickCoachAction(accountId, slug, id, now));

  it("stores a week once and gives it only to its owner, without mentor questions", async () => {
    expect(await save(week, [action("read-tip:t-1", now.toISOString())])).toBe(true);
    expect(await save(week, [])).toBe(false);
    const [mine] = await readAs("seller", previousWeek(week));
    expect(mine).toMatchObject({ week, writtenBy: "fixed", doneIds: null, goneIds: null, ticks: [] });
    expect(mine.actions.map((a) => a.id)).toEqual(["read-tip:t-1"]);
    expect(mine).not.toHaveProperty("mentorQuestions");
    expect(await readAs("shopper", previousWeek(week))).toEqual([]);
  });

  it("ticks this week's seller-ticked actions only, once", async () => {
    await save(week, [
      action("read-tip:t-1", now.toISOString()),
      { ...action("list-more:shop", now.toISOString()), target: { type: "shop", id: null } },
    ]);
    expect(await tickAs("seller", "read-tip:t-1")).toBe("ticked");
    expect(await tickAs("seller", "read-tip:t-1")).toBe("already");
    expect(await tickAs("seller", "list-more:shop")).toBe("not-found");
    expect(await tickAs("shopper", "read-tip:t-1")).toBe("not-found");
    expect((await readAs("seller", week))[0].ticks).toEqual(["read-tip:t-1"]);
  });

  it("settles a week once", async () => {
    await save(previousWeek(week), [action("read-tip:t-0", now.toISOString())]);
    expect(await settleCoachWeek(slug, previousWeek(week), { done: ["read-tip:t-0"], gone: [] }, now)).toBe(true);
    expect(await settleCoachWeek(slug, previousWeek(week), { done: [], gone: [] }, now)).toBe(false);
    expect((await readAs("seller", previousWeek(week)))[0].doneIds).toEqual(["read-tip:t-0"]);
  });

  it("gives the owner's weeks to the data download, never mentor questions", async () => {
    await saveCoachWeek(
      slug,
      { week, actions: [action("read-tip:t-1", now.toISOString())], writtenBy: "model", mentorQuestions: ["How did the photos go?", "What sold?"] },
      now,
    );
    const exported = await world.asViewer("seller", (id) => exportCoach(id));
    expect(exported).toEqual([
      { week, writtenBy: "model", actions: [{ kind: "read-tip", title: "Read: A tip", why: "A short tip.", ticked: false, doneWhenWeekEnded: null }] },
    ]);
    expect(JSON.stringify(exported)).not.toContain("What sold?");
  });

  it("reads a shop's facts and live facts the same way", async () => {
    const id = await world.addListing(slug, { title: "Contract lamp", categorySlug: "tech", description: "Short." });
    const queue = { replies: { count: 0, oldest: null }, sales: [], listings: { available: 1, paused: 0, sold: 0, drafts: 0 } };
    const facts = await world.asViewer("seller", () => shopFacts({ slug, ownerId: seller }, queue, now, []));
    expect(facts.listings.find((l) => l.id === id)).toMatchObject({ descriptionChars: 6, lastEnquiryAt: null });
    const live = await world.asViewer("seller", () =>
      liveFacts({ slug, ownerId: seller }, [{ ...action(`say-more:${id}`, now.toISOString()), target: { type: "listing", id } }], queue, now),
    );
    expect(live.listings.get(id)).toMatchObject({ state: "available", descriptionChars: 6 });
  });
}
