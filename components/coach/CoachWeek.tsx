import Link from "next/link";
import { Card } from "@/components/kit/Card";
import { CheckIcon } from "@/components/icons";
import { tickCoachAction } from "@/lib/coach/actions";
import { progressLine } from "@/lib/coach/done";
import type { CoachView } from "@/lib/coach/this-week";

type CoachWeekProps = { view: CoachView; from: "sell" | "hub" };

const TICK_WORDS = { "mark-done": "Mark done", kept: "Kept on purpose" } as const;
export const NOTHING_TO_DO = "Nothing to do this week. Your shop is in good shape.";

/**
 * Shop coach's week (AI round two spec 2): up to three actions, each with its one link, why, and whether it's done,
 * then last week's line. "This week" on /sell, "Your week" on the Launchpad. No client code: "Mark done" is a plain
 * form (planning decision 13). Links don't prefetch (decision 18).
 */
export function CoachWeek({ view, from }: CoachWeekProps) {
  return (
    <Card title={from === "sell" ? "This week" : "Your week"}>
      {view.items.length === 0 ? (
        <p className="coach-empty">{NOTHING_TO_DO}</p>
      ) : (
        <>
          <p className="coach-progress">{progressLine(view.progress)}</p>
          <ol className="coach-items">
            {view.items.map((item) => (
              <li key={item.id} className="coach-item" data-state={item.state}>
                <Link href={item.href} prefetch={false} className="coach-title">
                  {item.title}
                </Link>
                <p className="coach-why">{item.why}</p>
                {item.state === "done" && (
                  <p className="coach-state">
                    <CheckIcon aria-hidden="true" /> Done
                  </p>
                )}
                {item.state === "gone" && <p className="coach-state coach-gone">No longer needed</p>}
                {item.tick && (
                  <form action={tickCoachAction} className="coach-tick">
                    <input type="hidden" name="action" value={item.id} />
                    <input type="hidden" name="from" value={from} />
                    <button type="submit" className="btn btn-outline text-navy">
                      {TICK_WORDS[item.tick]}
                      <span className="sr-only">: {item.title}</span>
                    </button>
                  </form>
                )}
              </li>
            ))}
          </ol>
        </>
      )}
      {view.lastWeek && <p className="coach-last">{view.lastWeek}</p>}
    </Card>
  );
}
