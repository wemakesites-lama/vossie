import { sastDate } from "@/lib/time";

export type FeedGroupLabel = "Today" | "Yesterday" | "This week" | "Earlier";

const DAY_MS = 86_400_000;

/**
 * Items grouped by their SAST day (role views spec 5.2): Today, Yesterday, the 5 days before that as This week, then
 * Earlier; newest first within each; empty groups left out. `now` comes from the caller, at request time.
 */
export function groupBySastDay<T extends { at: string }>(items: readonly T[], now: Date) {
  const today = sastDate(now);
  const yesterday = sastDate(new Date(now.getTime() - DAY_MS));
  const weekStart = sastDate(new Date(now.getTime() - 6 * DAY_MS));
  const labelOf = (iso: string): FeedGroupLabel => {
    const day = sastDate(new Date(iso));
    if (day === today) return "Today";
    if (day === yesterday) return "Yesterday";
    return day >= weekStart ? "This week" : "Earlier";
  };
  const order: FeedGroupLabel[] = ["Today", "Yesterday", "This week", "Earlier"];
  const sorted = [...items].sort((a, b) => b.at.localeCompare(a.at));
  return order
    .map((label) => ({ label, items: sorted.filter((item) => labelOf(item.at) === label) }))
    .filter((group) => group.items.length > 0);
}
