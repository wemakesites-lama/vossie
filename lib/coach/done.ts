import { DESCRIPTION_WANTED, LISTINGS_WANTED, PHOTOS_WANTED, PRICE_RATIO } from "./kinds";
import type { ActionState, CoachAction, LiveFacts } from "./types";

// Whether each action is done (AI round two spec 2.1's "Done when"; I1 planning decisions 3, 4 and 8). Worked out
// live from each action's kind and target, so it's always current. Pure.

const after = (at: string, asOf: string) => Date.parse(at) > Date.parse(asOf);

export function actionState(action: CoachAction, live: LiveFacts, ticks: ReadonlySet<string>): ActionState {
  const id = action.target.id ?? "";
  const listing = live.listings.get(id);
  const listed = listing !== undefined && listing.state === "available" && !listing.hidden;
  switch (action.kind) {
    case "reply-waiting": {
      const oldest = live.queue.replies.oldest;
      return oldest === null || after(oldest.at, action.asOf) ? "done" : "open";
    }
    case "mark-sold":
      return live.queue.sales.some((sale) => !after(sale.at, action.asOf)) ? "open" : "done";
    case "add-photos":
      if (!listed) return "gone";
      return listing.photos >= PHOTOS_WANTED ? "done" : "open";
    case "say-more":
      if (!listed) return "gone";
      return listing.descriptionChars >= DESCRIPTION_WANTED ? "done" : "open";
    case "refresh-quiet":
      if (!listing || listing.state === "sold" || after(listing.updatedAt, action.asOf)) return "done";
      return listed ? "open" : "gone";
    case "check-price": {
      if (ticks.has(action.id)) return "done";
      if (!listed) return "gone";
      const middle = action.evidence.middle ?? 0;
      return listing.priceZar !== null && listing.priceZar < PRICE_RATIO * middle ? "done" : "open";
    }
    case "answer-request":
      if (live.offered.has(id)) return "done";
      return live.openRequests.has(id) ? "open" : "gone";
    case "list-more":
      return live.queue.listings.available >= LISTINGS_WANTED ? "done" : "open";
    case "finish-shop":
      return live.shop.about.trim() && live.shop.hasPhoto ? "done" : "open";
    case "go-to-launchpad":
      if (live.booked.has(id)) return "done";
      return live.publishedPosts.has(id) && !live.passedPosts.has(id) ? "open" : "gone";
    case "read-tip":
      if (ticks.has(action.id)) return "done";
      return live.publishedPosts.has(id) ? "open" : "gone";
  }
}

export type Progress = { done: number; total: number };

/** Gone actions are left out (decision 3). */
export function progressOf(states: readonly ActionState[]): Progress {
  return { done: states.filter((s) => s === "done").length, total: states.filter((s) => s !== "gone").length };
}

export function progressLine({ done, total }: Progress): string {
  return `${done} of ${total} done`;
}

/** Under the actions (spec 2). Null when there was no week before. */
export function lastWeekLine(progress: Progress | null): string | null {
  if (progress === null) return null;
  return progress.total === 0 ? "Last week: nothing to do" : `Last week: ${progressLine(progress)}`;
}

/**
 * What a settled week stores (decision 10): the ids done and the ids gone, so its "N of M" leaves gone actions out as a
 * live week's does (Task 7's settledProgress reads both).
 */
export function settledIds(actions: readonly CoachAction[], states: readonly ActionState[]): { done: string[]; gone: string[] } {
  return {
    done: actions.filter((_, i) => states[i] === "done").map((a) => a.id),
    gone: actions.filter((_, i) => states[i] === "gone").map((a) => a.id),
  };
}
