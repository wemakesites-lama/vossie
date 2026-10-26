import type { CSSProperties, ReactNode } from "react";
import { NavLink } from "@/components/ui/NavLink";
import { TAB } from "@/lib/motion";

export type SectionTab = {
  key: string;
  href: string;
  label: string;
  icon: ReactNode;
  /** "section" also marks the pages under href, as the main bar's Shop and Sell do. */
  match?: "section";
  /** Other paths whose pages also make this tab current (the admin bar's More, N3 plan decision 8). */
  also?: readonly string[];
  /** Only a tab whose route has no client component may prefetch (decision 53); everything else passes false. */
  prefetch?: false;
  /** A file, not a page: a plain <a download> (the mentor's CSV). */
  download?: boolean;
  /** Back to the main app: no tab transition, the page changes completely. */
  exit?: boolean;
  /** From the same reader as the list it opens (role views spec 4.2). null: the count failed, so no badge. */
  badge?: { count: number; words: string } | null;
  /** The sidebar's heading this tab sits under (wayfinding spec 3.3). Tabs without one sit in an unnamed group. */
  group?: string;
  /** "phone": only in the bottom bar (the admin's More); "wide": only in the sidebar, reached through More on phones. */
  only?: "phone" | "wide";
  /** The bottom bar's shorter label ("Hub" for Posts and office hours). */
  short?: string;
};

/** Runs of tabs under the same heading, in order. */
function grouped(tabs: readonly SectionTab[]): { label: string | undefined; tabs: SectionTab[] }[] {
  const groups: { label: string | undefined; tabs: SectionTab[] }[] = [];
  for (const tab of tabs) {
    const last = groups.at(-1);
    if (last && last.label === tab.group) last.tabs.push(tab);
    else groups.push({ label: tab.group, tabs: [tab] });
  }
  return groups;
}

/**
 * A section's own bar (role views spec 4.1): fixed to the bottom on phones in place of the main tab bar (the CSS hides
 * the main bar while this one is on the page), a sidebar from the tablet step. Tabs with a group sit under its heading
 * in the sidebar; on phones the groups fold into one row of the tabs not marked "wide" (wayfinding spec 3.3). One set
 * of links either way. Server-rendered; the only client code is NavLink, already in every page's layout chunk.
 */
export function SectionBar({
  label,
  tabs,
  side = false,
}: {
  label: string;
  tabs: readonly SectionTab[];
  /** A desktop-only side panel in the reserved column (`section-side`): never fixed to the bottom, never in place of
   * the main bar, and none of the phone rules that key on `.section-bar` apply. */
  side?: boolean;
}) {
  const phoneTabs = tabs.filter((tab) => tab.only !== "wide").length;
  return (
    <nav aria-label={label} className={side ? "section-side" : "section-bar"} style={{ "--tabs": phoneTabs } as CSSProperties}>
      {grouped(tabs).map((group, index) => (
        <div key={group.label ?? `group-${index}`} className="section-group">
          {group.label && <h2 className="section-group-label">{group.label}</h2>}
          <ul>
            {group.tabs.map((tab) => (
              <li key={tab.key} data-only={tab.only}>
                <SectionLink tab={tab} />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function SectionLink({ tab }: { tab: SectionTab }) {
  const badgeId = `section-badge-${tab.key}`;
  const badge = tab.badge && tab.badge.count > 0 ? tab.badge : null;
  const inside = (
    <>
      <span className="section-tab-icon">{tab.icon}</span>
      {tab.short ? (
        <>
          <span className="section-tab-label section-tab-label-wide">{tab.label}</span>
          <span className="section-tab-label section-tab-label-phone">{tab.short}</span>
        </>
      ) : (
        <span className="section-tab-label">{tab.label}</span>
      )}
      {badge && (
        <span id={badgeId} className="hdr-badge hdr-badge-alert" aria-hidden="true">
          {badge.count > 99 ? "99+" : badge.count} <span className="sr-only">{badge.words}</span>
        </span>
      )}
    </>
  );
  if (tab.download) {
    return (
      <a href={tab.href} download className="section-tab" aria-describedby={badge ? badgeId : undefined}>
        {inside}
      </a>
    );
  }
  return (
    <NavLink
      href={tab.href}
      match={tab.match}
      also={tab.also}
      prefetch={tab.prefetch}
      transitionTypes={tab.exit ? undefined : TAB}
      className="section-tab"
      aria-describedby={badge ? badgeId : undefined}
    >
      {inside}
    </NavLink>
  );
}
