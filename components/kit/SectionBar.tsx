import type { CSSProperties, ReactNode } from "react";
import { NavLink } from "@/components/ui/NavLink";

export type SectionTab = {
  key: string;
  href: string;
  label: string;
  icon: ReactNode;
  /** "section" also marks the pages under href, as the main bar's Shop and Sell do. */
  match?: "section";
  /** Only a tab whose route has no client component may prefetch (decision 53); everything else passes false. */
  prefetch?: false;
  /** A file, not a page: a plain <a download> (the mentor's CSV). */
  download?: boolean;
  /** Back to the main app: no tab transition, the page changes completely. */
  exit?: boolean;
  /** From the same reader as the list it opens (role views spec 4.2). null: the count failed, so no badge. */
  badge?: { count: number; words: string } | null;
};

/**
 * A section's own bar (role views spec 4.1): fixed to the bottom on phones in place of the main tab bar (the CSS hides
 * the main bar while this one is on the page), a sidebar from the tablet step. Server-rendered; the only client code
 * is NavLink, already in every page's layout chunk.
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
  return (
    <nav aria-label={label} className={side ? "section-side" : "section-bar"}>
      <ul style={{ "--tabs": tabs.length } as CSSProperties}>
        {tabs.map((tab) => (
          <li key={tab.key}>
            <SectionLink tab={tab} />
          </li>
        ))}
      </ul>
    </nav>
  );
}

function SectionLink({ tab }: { tab: SectionTab }) {
  const badgeId = `section-badge-${tab.key}`;
  const badge = tab.badge && tab.badge.count > 0 ? tab.badge : null;
  const inside = (
    <>
      <span className="section-tab-icon">{tab.icon}</span>
      <span className="section-tab-label">{tab.label}</span>
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
      prefetch={tab.prefetch}
      transitionTypes={tab.exit ? undefined : ["nav-tab"]}
      className="section-tab"
      aria-describedby={badge ? badgeId : undefined}
    >
      {inside}
    </NavLink>
  );
}
