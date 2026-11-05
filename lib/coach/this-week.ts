import { aiFeatureOn } from "@/lib/ai/config";
import { onSupabase } from "@/lib/backend";
import { readOwnCoachWeeks, saveCoachWeek, settleCoachWeek } from "@/lib/data/coach";
import { liveFacts, shopFacts, type CoachShop } from "@/lib/data/coach-facts";
import type { OwnShop } from "@/lib/data/shops";
import { queueFor } from "@/lib/selling/queue";
import type { SellerQueue } from "@/lib/types";
import { candidatesFor } from "./candidates";
import { actionState, lastWeekLine, progressOf, settledIds, type Progress } from "./done";
import { SELLER_TICKED } from "./kinds";
import { planWeek } from "./plan";
import type { ActionState, CoachAction, CoachWeek } from "./types";
import { coachWeekOf, lazyAllowed, previousWeek, weeksBack } from "./week";

// This week's coaching for the signed-in seller (AI round two spec 2; I1 plan Task 7). Request-time only, inside
// <Suspense>, after getViewer() (which awaited connection()); never inside "use cache". Making a missing week here is
// the lazy path (planning decision 11); makeCoachWeek is also stage I2's writer for the fixed fallback.

export type CoachItem = CoachAction & { state: ActionState; tick: "mark-done" | "kept" | null };
export type CoachView = { week: string; items: CoachItem[]; progress: Progress; lastWeek: string | null };

type Queue = Pick<SellerQueue, "replies" | "sales" | "listings">;

/** A week's states, live, with its own ticks. */
export async function statesOf(shop: CoachShop, week: CoachWeek, queue: Queue, now: Date): Promise<ActionState[]> {
  const live = await liveFacts(shop, week.actions, queue, now);
  const ticks = new Set(week.ticks);
  return week.actions.map((action) => actionState(action, live, ticks));
}

/** A settled week's progress, from its stored ids (decision 10). */
export function settledProgress(week: CoachWeek): Progress | null {
  if (week.doneIds === null || week.goneIds === null) return null;
  return { done: week.doneIds.length, total: week.actions.length - week.goneIds.length };
}

/** Settles `week` once, from live states. */
export async function settleWeek(shop: CoachShop, week: CoachWeek, queue: Queue, now: Date): Promise<void> {
  if (week.settledAt) return;
  await settleCoachWeek(shop.slug, week.week, settledIds(week.actions, await statesOf(shop, week, queue, now)), now);
}

/**
 * Makes the shop's week in fixed wording (spec 4) unless it has one, settling last week first. `weeks` are the shop's
 * recent rows (12 weeks), newest first. How many actions this call stored, or null when it stored nothing (stage I2's
 * collect run notifies only for a stored week with actions).
 */
export async function makeCoachWeek(shop: CoachShop, weeks: readonly CoachWeek[], queue: Queue, now: Date): Promise<number | null> {
  const week = coachWeekOf(now);
  if (weeks.some((w) => w.week === week)) return null;
  const last = weeks.find((w) => w.week === previousWeek(week));
  if (last) await settleWeek(shop, last, queue, now);
  const tickedTips = weeks.flatMap((w) => w.ticks.filter((id) => id.startsWith("read-tip:")).map((id) => id.slice("read-tip:".length)));
  const facts = await shopFacts(shop, queue, now, tickedTips);
  const actions = planWeek(candidatesFor(facts, now), facts.asOf);
  const stored = await saveCoachWeek(shop.slug, { week, actions, writtenBy: "fixed", mentorQuestions: null }, now);
  return stored ? actions.length : null;
}

/** The "This week" card's view, or null when there's no card (switch off, not approved, or not made yet on Supabase). */
export async function readThisWeek(account: { id: string }, own: OwnShop, now: Date): Promise<CoachView | null> {
  if (!aiFeatureOn("shop-coach") || own.status !== "approved" || own.shop.ownerId !== account.id) return null;
  const shop = { slug: own.shop.slug, ownerId: account.id };
  const week = coachWeekOf(now);
  const queue = await queueFor(shop.slug);
  let weeks = await readOwnCoachWeeks(account.id, shop.slug, weeksBack(week));
  if (!weeks.some((w) => w.week === week)) {
    if (!lazyAllowed(now, onSupabase())) return null;
    await makeCoachWeek(shop, weeks, queue, now);
    weeks = await readOwnCoachWeeks(account.id, shop.slug, weeksBack(week));
  }
  const current = weeks.find((w) => w.week === week);
  if (!current) return null;
  const last = weeks.find((w) => w.week === previousWeek(week)) ?? null;
  const [states, lastStates] = await Promise.all([
    statesOf(shop, current, queue, now),
    last && !last.settledAt ? statesOf(shop, last, queue, now) : Promise.resolve(null),
  ]);
  const items = current.actions.map((action, i) => ({
    ...action,
    state: states[i],
    tick: states[i] === "open" && SELLER_TICKED.has(action.kind) ? (action.kind === "check-price" ? "kept" : "mark-done") : null,
  })) satisfies CoachItem[];
  return {
    week,
    items,
    progress: progressOf(states),
    lastWeek: lastWeekLine(last ? (settledProgress(last) ?? progressOf(lastStates ?? [])) : null),
  };
}
