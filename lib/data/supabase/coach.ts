import "server-only";
import { asCoachActions } from "@/lib/coach/plan";
import type { CoachWeek } from "@/lib/coach/types";
import type { Json } from "@/lib/supabase/database.types";
import type * as Sample from "../coach";
import { forServer, forViewer } from "./clients";
import { iso } from "./rows";
import { forViewerAs } from "./viewer";

// Shop coach's weeks and ticks on Supabase (AI stage I1 plan Task 6): coach_weeks and coach_ticks are closed to every
// API role. The owner reads through own_coach_weeks with the viewer's session (never the mentor questions), ticks
// through tick_coach_action with the same session, and the weeks themselves are written with the admin client.
// Request-time only.

function failed(what: string, error: { code?: string }): never {
  throw new Error(`${what} failed (${error.code ?? "unknown"})`);
}

async function ownWeeks(accountId: string, since: string | null): Promise<CoachWeek[]> {
  const { data, error } = await (await forViewerAs(accountId)).rpc("own_coach_weeks", { p_since: since as string });
  if (error) failed("own_coach_weeks", error);
  return data.flatMap((row) => {
    const actions = asCoachActions(row.actions);
    if (actions === null) {
      console.warn(`coach_weeks: the week of ${row.week} has actions in the wrong shape`);
      return [];
    }
    return [
      {
        week: row.week,
        actions,
        writtenBy: row.written_by as CoachWeek["writtenBy"],
        doneIds: row.done_ids,
        goneIds: row.gone_ids,
        settledAt: iso(row.settled_at),
        createdAt: iso(row.created_at),
        ticks: row.ticks ?? [],
      },
    ];
  });
}

export const readOwnCoachWeeks: typeof Sample.readOwnCoachWeeks = (accountId, _sellerSlug, since) => ownWeeks(accountId, since);

export const everyOwnWeek = (accountId: string): Promise<CoachWeek[]> => ownWeeks(accountId, null);

async function shopIdOf(slug: string): Promise<string | null> {
  const { data, error } = await forServer().from("shops").select("id").eq("slug", slug).maybeSingle();
  if (error) failed("shops", error);
  return data?.id ?? null;
}

export const saveCoachWeek: typeof Sample.saveCoachWeek = async (sellerSlug, week) => {
  const shopId = await shopIdOf(sellerSlug);
  if (shopId === null) return false;
  const { data, error } = await forServer()
    .from("coach_weeks")
    .upsert(
      {
        shop_id: shopId,
        week: week.week,
        // A week's actions are always an array (possibly empty), never null: the column is `not null`.
        actions: week.actions as unknown as NonNullable<Json>,
        mentor_questions: week.mentorQuestions as unknown as Json,
        written_by: week.writtenBy,
      },
      { onConflict: "shop_id,week", ignoreDuplicates: true },
    )
    .select("week");
  if (error) failed("coach_weeks", error);
  return data.length === 1;
};

export const settleCoachWeek: typeof Sample.settleCoachWeek = async (sellerSlug, week, ids, now) => {
  const shopId = await shopIdOf(sellerSlug);
  if (shopId === null) return false;
  const { data, error } = await forServer()
    .from("coach_weeks")
    .update({ done_ids: ids.done, gone_ids: ids.gone, settled_at: now.toISOString() })
    .eq("shop_id", shopId)
    .eq("week", week)
    .is("settled_at", null)
    .select("week");
  if (error) failed("coach_weeks", error);
  return data.length === 1;
};

export async function tickCoachAction(actionId: string): Promise<Sample.TickResult> {
  const { data, error } = await (await forViewer()).rpc("tick_coach_action", { p_action: actionId });
  if (error) failed("tick_coach_action", error);
  if (data === "ticked" || data === "already" || data === "not-found") return data;
  throw new Error("tick_coach_action answered something unexpected");
}
