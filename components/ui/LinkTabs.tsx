import Link from "next/link";

/** `count`: drawn under the label in the segmented look (role views N2 plan decision 12). */
export type LinkTab = { key: string; label: string; href: string; count?: number };

type LinkTabsProps = {
  /** The row's name for screen readers, e.g. "Categories". */
  label: string;
  tabs: readonly LinkTab[];
  /** The key of the tab this page shows. */
  current: string;
  /** "chips": pills, the board's (plan decision 7). "tabs": browse's underlined tabs, the Hub's. "segmented": 2 to 4
   * views as one control (role views spec 5.2). */
  look: "chips" | "tabs" | "segmented";
};

/**
 * A row of filter links (community spec 4.1 and 5.1), the one this page shows marked with aria-current. It scrolls
 * sideways on phones when it doesn't fit, like browse's category tabs. No prefetching: each link is a different page
 * of results (decision 28).
 */
export function LinkTabs({ label, tabs, current, look }: LinkTabsProps) {
  const navClass = { chips: "link-chips", tabs: "category-tabs", segmented: "link-segments" }[look];
  const linkClass = { chips: "link-chip", tabs: "category-tab", segmented: "link-segment" }[look];
  return (
    <nav aria-label={label} className={navClass}>
      <ul>
        {tabs.map((tab) => (
          <li key={tab.key}>
            <Link
              href={tab.href}
              prefetch={false}
              aria-current={tab.key === current ? "page" : undefined}
              className={linkClass}
            >
              {tab.count === undefined ? (
                tab.label
              ) : (
                <>
                  <span className="link-segment-label">{tab.label}</span>{" "}
                  <span className="link-segment-count">{tab.count}</span>
                </>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
