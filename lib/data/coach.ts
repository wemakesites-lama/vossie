import { onSupabase } from "@/lib/backend";
import { SELLER_TICKED } from "@/lib/coach/kinds";
import type { CoachAction, CoachWeek } from "@/lib/coach/types";
import { coachWeekOf } from "@/lib/coach/week";
import { sampleStore } from "./store";

// Shop coach's weeks and ticks (AI round two spec 4; I1 plan Task 6). Request-time only, never inside "use cache".
// The sample store keys a shop's weeks by its owner (planning decision 14); Supabase by shop, read through the
// owner-only own_coach_weeks with the viewer's session, written with the admin client. Mentor questions never leave
// this module towards a seller: readOwnCoachWeeks and exportCoach leave them out.

const supabase = () => import("./supabase/coach");

export type NewCoachWeek = Pick<CoachWeek, "week" | "actions" | "writtenBy"> & { mentorQuestions: [string, string] | null };
export type TickResult = "ticked" | "already" | "not-found";

const ownerOf = (slug: string) => sampleStore().sellers.get(slug)?.ownerId ?? null;
const weekKey = (ownerId: string, week: string) => `${ownerId}:${week}`;

function ticksOf(ownerId: string, week: string): string[] {
  return [...sampleStore().coachTicks.values()]
    .filter((t) => t.ownerId === ownerId && t.week === week)
    .map((t) => t.actionId)
    .sort();
}

/** The signed-in owner's weeks from `since` (a Monday) on, newest first. Never the mentor questions. */
export async function readOwnCoachWeeks(accountId: string, sellerSlug: string, since: string): Promise<CoachWeek[]> {
  if (onSupabase()) return (await supabase()).readOwnCoachWeeks(accountId, sellerSlug, since);
  if (ownerOf(sellerSlug) !== accountId) return [];
  return [...sampleStore().coachWeeks.values()]
    .filter((row) => row.ownerId === accountId && row.week >= since)
    .sort((a, b) => b.week.localeCompare(a.week))
    .map(({ week, actions, writtenBy, doneIds, goneIds, settledAt, createdAt }) => ({
      week,
      actions: structuredClone(actions),
      writtenBy,
      doneIds: doneIds && [...doneIds],
      goneIds: goneIds && [...goneIds],
      settledAt,
      createdAt,
      ticks: ticksOf(accountId, week),
    }));
}

/** Stores a week unless the shop has one (the cron and the lazy path race safely). True when this call stored it. */
export async function saveCoachWeek(sellerSlug: string, week: NewCoachWeek, now: Date): Promise<boolean> {
  if (onSupabase()) return (await supabase()).saveCoachWeek(sellerSlug, week, now);
  const ownerId = ownerOf(sellerSlug);
  if (!ownerId) return false;
  const key = weekKey(ownerId, week.week);
  if (sampleStore().coachWeeks.has(key)) return false;
  sampleStore().coachWeeks.set(key, {
    ownerId,
    week: week.week,
    actions: structuredClone(week.actions),
    mentorQuestions: week.mentorQuestions,
    writtenBy: week.writtenBy,
    doneIds: null,
    goneIds: null,
    settledAt: null,
    createdAt: now.toISOString(),
  });
  return true;
}

/** Settles a week once (planning decision 10). True when this call settled it. */
export async function settleCoachWeek(
  sellerSlug: string,
  week: string,
  ids: { done: string[]; gone: string[] },
  now: Date,
): Promise<boolean> {
  if (onSupabase()) return (await supabase()).settleCoachWeek(sellerSlug, week, ids, now);
  const ownerId = ownerOf(sellerSlug);
  const row = ownerId ? sampleStore().coachWeeks.get(weekKey(ownerId, week)) : undefined;
  if (!row || row.settledAt) return false;
  Object.assign(row, { doneIds: [...ids.done], goneIds: [...ids.gone], settledAt: now.toISOString() });
  return true;
}

/** The seller ticks one of this week's actions of a kind only they can tick (planning decision 13). */
export async function tickCoachAction(
  accountId: string,
  sellerSlug: string,
  actionId: string,
  now: Date,
): Promise<TickResult> {
  if (onSupabase()) return (await supabase()).tickCoachAction(actionId);
  if (ownerOf(sellerSlug) !== accountId) return "not-found";
  const week = coachWeekOf(now);
  const row = sampleStore().coachWeeks.get(weekKey(accountId, week));
  const action = row?.actions.find((a) => a.id === actionId);
  if (!action || !SELLER_TICKED.has(action.kind)) return "not-found";
  const key = `${accountId}:${week}:${actionId}`;
  if (sampleStore().coachTicks.has(key)) return "already";
  sampleStore().coachTicks.set(key, { ownerId: accountId, week, actionId, createdAt: now.toISOString() });
  return "ticked";
}

export type CoachExport = {
  week: string;
  writtenBy: "model" | "fixed";
  actions: { kind: CoachAction["kind"]; title: string; why: string; ticked: boolean; doneWhenWeekEnded: boolean | null }[];
};

/** Every week of the account's own shop, newest first: on Supabase own_coach_weeks(null) with the viewer's session. */
async function everyOwnWeek(accountId: string): Promise<CoachWeek[]> {
  if (onSupabase()) return (await supabase()).everyOwnWeek(accountId);
  const slug = [...sampleStore().sellers.values()].find((shop) => shop.ownerId === accountId)?.slug;
  return slug ? readOwnCoachWeeks(accountId, slug, "0000-01-01") : [];
}

/** The account's shop's weeks for its data download (planning decision 17), newest first. No mentor questions. */
export async function exportCoach(accountId: string): Promise<CoachExport[]> {
  return (await everyOwnWeek(accountId)).map((w) => ({
    week: w.week,
    writtenBy: w.writtenBy,
    actions: w.actions.map((a) => ({
      kind: a.kind,
      title: a.title,
      why: a.why,
      ticked: w.ticks.includes(a.id),
      doneWhenWeekEnded: w.doneIds === null ? null : w.doneIds.includes(a.id),
    })),
  }));
}

/** Deleting an account (sample store): its shop's weeks and ticks. On Supabase the shops cascade does it. */
export function forgetCoachOf(accountId: string): void {
  const { coachWeeks, coachTicks } = sampleStore();
  for (const [key, row] of coachWeeks) if (row.ownerId === accountId) coachWeeks.delete(key);
  for (const [key, row] of coachTicks) if (row.ownerId === accountId) coachTicks.delete(key);
}
