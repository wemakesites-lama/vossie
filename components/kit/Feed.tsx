import type { ReactNode } from "react";
import { groupBySastDay } from "@/lib/kit/feed-groups";

type FeedItem = { id: string; at: string; content: ReactNode };

/** A feed grouped by SAST day (role views spec 5.2). Callers collapse repeats before passing items. */
export function Feed({ label, items, now }: { label: string; items: readonly FeedItem[]; now: Date }) {
  return (
    <div aria-label={label} role="group" className="feed">
      {groupBySastDay(items, now).map((group) => (
        <section key={group.label} aria-label={group.label} className="feed-group">
          <h3 className="kit-section-title">{group.label}</h3>
          <ul className="feed-items">
            {group.items.map((item) => (
              <li key={item.id}>{item.content}</li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
