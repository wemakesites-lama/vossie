import Link from "next/link";

export type LinkTab = { key: string; label: string; href: string };

type LinkTabsProps = {
  /** The row's name for screen readers, e.g. "Categories". */
  label: string;
  tabs: readonly LinkTab[];
  /** The key of the tab this page shows. */
  current: string;
  /** "chips": pills, the board's (plan decision 7). "tabs": browse's underlined tabs, the Hub's. */
  look: "chips" | "tabs";
};

/**
 * A row of filter links (community spec 4.1 and 5.1), the one this page shows marked with aria-current. It scrolls
 * sideways on phones when it doesn't fit, like browse's category tabs. No prefetching: each link is a different page
 * of results (decision 28).
 */
export function LinkTabs({ label, tabs, current, look }: LinkTabsProps) {
  const chips = look === "chips";
  return (
    <nav aria-label={label} className={chips ? "link-chips" : "category-tabs"}>
      <ul>
        {tabs.map((tab) => (
          <li key={tab.key}>
            <Link
              href={tab.href}
              prefetch={false}
              aria-current={tab.key === current ? "page" : undefined}
              className={chips ? "link-chip" : "category-tab"}
            >
              {tab.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
