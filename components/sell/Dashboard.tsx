import Link from "next/link";
import { ChevronRightIcon } from "@/components/icons";
import { StatRow, StatTile } from "@/components/kit/StatTile";
import { cx } from "@/lib/cx";
import { followersLine } from "@/lib/following/rules";
import { badgeLabel } from "@/lib/format";
import { inboxPath } from "@/lib/messaging/paths";
import { myListingsPath, NEW_LISTING_PATH, PROFILE_PATH } from "@/lib/selling/paths";
import { pauseShop, resumeShop } from "@/lib/selling/shop-actions";
import type { ShopStats, TrustBadge } from "@/lib/types";

type DashboardProps = {
  shop: { name: string; slug: string; badge: TrustBadge | null };
  paused: boolean;
  stats: ShopStats;
  /** What the next badge needs (lib/selling/badges.ts). */
  badgeLine: string;
  /** The words for the last action's notice, if any. */
  notice: string | null;
  /** The Hub's reason when the Hub paused the shop (staff tools plan decision 3); the seller can't resume it. */
  hubPause?: string | null;
  /** How many follow the shop (community actions spec 2.18): the shop sees the number, never who. */
  followers?: number;
};

/**
 * The dashboard (selling spec 2.8, plan decision 18): whether the shop is live, the last 7 days' numbers, the badge
 * and what the next one needs, the shop's pages, and Pause my shop or Resume. No view counts: nothing records views.
 * A shop the Hub paused says so, with the Hub's reason and no Pause or Resume form (staff tools plan decision 3).
 */
export function Dashboard({ shop, paused, stats, badgeLine, notice, hubPause = null, followers = 0 }: DashboardProps) {
  const byHub = hubPause !== null;
  const { week } = stats;
  const pages: Array<[label: string, href: string]> = [
    ["New listing", NEW_LISTING_PATH],
    ["My listings", myListingsPath()],
    ["Messages from buyers", inboxPath("selling")],
    ["Edit shop", PROFILE_PATH],
  ];
  // A shop the Hub paused has no storefront while it's paused: its page answers 404 (amendment 13.2).
  if (!byHub) pages.push(["View your shop", `/sellers/${shop.slug}`]);
  return (
    <div className="sell-column">
      <header className="sell-head">
        <p className="eyebrow">Your shop</p>
        <h1 className="sell-title">{shop.name}</h1>
        <p className={cx("sell-status", paused && "sell-status-paused")}>
          {byHub
            ? "Paused by the Hub: buyers can't see your listings"
            : paused
              ? "Paused: buyers can't see your listings"
              : "Your shop is live"}
        </p>
        <p className="sell-followers">{followersLine(followers)}</p>
      </header>

      {notice && (
        <p role="status" className="form-notice">
          {notice}
        </p>
      )}

      {byHub && (
        <section aria-labelledby="sell-hub-pause-title" className="sell-section">
          <h2 id="sell-hub-pause-title" className="sell-section-title">
            Why the Hub paused it
          </h2>
          <blockquote className="staff-reason">{hubPause}</blockquote>
          <p>Only the Hub can resume it. Talk to the Hub on your campus once you&apos;ve sorted it out.</p>
        </section>
      )}

      <section aria-labelledby="sell-week-title" className="sell-section">
        <h2 id="sell-week-title" className="sell-section-title">
          In the last 7 days
        </h2>
        <StatRow label="In the last 7 days">
          <StatTile label="New enquiries" value={week.enquiries} />
          {/* Words, not a number, so a "0" never sits beside "None due yet". */}
          <div className="stat-tile">
            <span className="stat-tile-label">Replied within 48 hours</span>{" "}
            <span className="stat-tile-value" data-masked="">
              {week.due === 0 ? "None due yet" : `${week.repliedInTime} of ${week.due}`}
            </span>
          </div>
          <StatTile label="Sales confirmed" value={week.salesConfirmed} />
        </StatRow>
      </section>

      <section aria-labelledby="sell-badge-title" className="sell-section">
        <h2 id="sell-badge-title" className="sell-section-title">
          Your badge
        </h2>
        <p className="sell-badge">{shop.badge ? badgeLabel(shop.badge) : "No badge yet"}</p>
        <p>
          {badgeLine}{" "}
          <Link href="/trust" prefetch={false}>
            How badges work
          </Link>
        </p>
      </section>

      <nav aria-labelledby="sell-pages-title" className="sell-section">
        <h2 id="sell-pages-title" className="sell-section-title">
          Your shop&apos;s pages
        </h2>
        <ul className="sell-rows">
          {pages.map(([label, href]) => (
            <li key={href}>
              <Link href={href} prefetch={false} className="sell-row">
                {label}
                <ChevronRightIcon />
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {!byHub && (
        <form action={paused ? resumeShop : pauseShop} className="sell-pause">
          <p>
            {paused
              ? "Your listings come back as soon as you resume."
              : "Taking a break? Pausing hides your listings until you resume."}
          </p>
          <button type="submit" className="btn btn-outline text-navy">
            {paused ? "Resume my shop" : "Pause my shop"}
          </button>
        </form>
      )}
    </div>
  );
}
