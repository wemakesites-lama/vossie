import Link from "next/link";
import { RatioBar } from "@/components/charts/RatioBar";
import { Sparkline } from "@/components/charts/Sparkline";
import { SplitBar } from "@/components/charts/SplitBar";
import { SectionError } from "@/components/home/SectionError";
import { Card } from "@/components/kit/Card";
import { NeedsYouList } from "@/components/kit/NeedsYouList";
import { Pill } from "@/components/kit/Pill";
import { SetupChecklist } from "@/components/kit/SetupChecklist";
import { StatRow, StatTile } from "@/components/kit/StatTile";
import type { SellerRow } from "@/lib/data/rows";
import { badgeLabel } from "@/lib/format";
import { inboxPath } from "@/lib/messaging/paths";
import { replyRateTarget } from "@/lib/selling/badges";
import {
  dayLabels,
  enquirySummary,
  followerCountLabel,
  isNewShop,
  newFollowersLine,
  sellerNeeds,
  setupSteps,
} from "@/lib/selling/home";
import { myListingsPath, NEW_LISTING_PATH, SELL_PATH } from "@/lib/selling/paths";
import { pauseShop, resumeShop } from "@/lib/selling/shop-actions";
import type { EnquiryCounts, FollowerCounts, RecentCounts, SellerQueue } from "@/lib/types";

type DashboardProps = {
  shop: Pick<SellerRow, "name" | "slug" | "badge" | "image" | "about" | "pickupPointIds">;
  paused: boolean;
  /** The Hub's reason when the Hub paused the shop (staff tools plan decision 3); the seller can't resume it. */
  hubPause?: string | null;
  /** The words for the last action's notice, if any. */
  notice: string | null;
  /** Read after `await connection()`, for the age chips. */
  now: Date;
  /** Each reader's answer, or null when it failed: that card shows its error box (spec 8). */
  queue: SellerQueue | null;
  /** The badge rules' record (shopStats's `record`). */
  record: EnquiryCounts | null;
  /** What the next badge needs (lib/selling/badges.ts). */
  badgeLine: string;
  week: RecentCounts | null;
  /** Enquiries per SAST day, the last 7, oldest first. */
  daily: readonly (number | null)[] | null;
  followers: FollowerCounts | null;
  /** The shop's campus has pickup points to choose (the checklist's third step). */
  campusHasPoints: boolean;
};

const PERIOD = "the week before";

/**
 * The seller home (role views spec 7.1): what needs the seller now, then a few honest numbers and small charts, or the
 * setup checklist for a new shop. No view counts: nothing records views. Followers are a number, never who. A shop the
 * Hub paused says so, with the Hub's reason and no Pause or Resume (staff tools plan decision 3). Each card stands on
 * its own reader: one failing shows its error box and leaves the rest (spec 8).
 */
export function Dashboard(props: DashboardProps) {
  const { shop, paused, hubPause = null, notice, now, queue, record, badgeLine, week, daily, followers, campusHasPoints } =
    props;
  const byHub = hubPause !== null;
  const newShop = queue !== null && isNewShop(queue);
  return (
    <div className="sell-column sell-home">
      <Card>
        <header className="sell-home-head">
          <p className="eyebrow">Your shop</p>
          <h1 className="sell-title">{shop.name}</h1>
          <ul className="sell-home-facts">
            <li>
              {byHub ? (
                <Pill tone="danger">Paused by the Hub</Pill>
              ) : paused ? (
                <Pill tone="warning">Paused</Pill>
              ) : (
                <Pill tone="live">Live</Pill>
              )}
            </li>
            <li>
              <Pill tone="neutral">{shop.badge ? badgeLabel(shop.badge) : "No badge yet"}</Pill>
            </li>
            {followers && <li className="sell-home-followers">{followerCountLabel(followers.total)}</li>}
          </ul>
          {paused && (
            <p className="sell-home-note">
              {byHub
                ? "Buyers can't see your listings. Only the Hub can resume your shop."
                : "Buyers can't see your listings until you resume your shop."}
            </p>
          )}
          {/* A shop the Hub paused has no storefront while it's paused: its page answers 404 (amendment 13.2). */}
          {!byHub && (
            <Link href={`/sellers/${shop.slug}`} prefetch={false} className="sell-home-link">
              View your shop
            </Link>
          )}
        </header>
      </Card>

      {notice && (
        <p role="status" className="form-notice">
          {notice}
        </p>
      )}

      {byHub && (
        <Card title="Why the Hub paused it">
          <blockquote className="staff-reason">{hubPause}</blockquote>
          <p>Only the Hub can resume it. Talk to the Hub on your campus once you&apos;ve sorted it out.</p>
        </Card>
      )}

      <Card title="Needs you">
        {queue ? (
          <NeedsYouList label="Needs you" items={sellerNeeds(queue, now)} allClear="All clear: nothing is waiting for you." />
        ) : (
          <SectionError id="sell-needs" title="What needs you" path={SELL_PATH} />
        )}
      </Card>

      <div className="sell-home-buttons">
        <Link href={NEW_LISTING_PATH} prefetch={false} className="btn btn-primary">
          New listing
        </Link>
        <Link href={inboxPath("selling")} prefetch={false} className="btn btn-outline text-navy">
          Messages
        </Link>
      </div>

      {newShop ? (
        <SetupChecklist title="Get your shop going" steps={setupSteps(shop, queue, campusHasPoints)} />
      ) : (
        <>
          <Card title="In the last 7 days">
            {week ? (
              <StatRow label="In the last 7 days">
                <StatTile
                  key="enquiries"
                  label="Enquiries"
                  value={week.enquiries}
                  delta={{ previous: week.previous.enquiries, period: PERIOD }}
                />
                <StatTile
                  key="sales"
                  label="Sales"
                  value={week.salesConfirmed}
                  delta={{ previous: week.previous.salesConfirmed, period: PERIOD }}
                />
                {followers && (
                  <StatTile
                    key="followers"
                    label="Followers"
                    value={followers.total}
                    footer={<p className="stat-tile-note">{newFollowersLine(followers.recent)}</p>}
                  />
                )}
              </StatRow>
            ) : (
              <SectionError id="sell-week" title="Your numbers" path={SELL_PATH} />
            )}
          </Card>

          <Card title="Enquiries, last 7 days">
            {daily ? (
              <Sparkline
                points={daily}
                labels={dayLabels(daily.length, now)}
                label="Enquiries"
                summary={enquirySummary(daily)}
              />
            ) : (
              <SectionError id="sell-daily" title="Your enquiries by day" path={SELL_PATH} />
            )}
          </Card>

          <Card title="Your badge" action={{ label: "How badges work", href: "/trust" }}>
            <p className="sell-badge">{shop.badge ? badgeLabel(shop.badge) : "No badge yet"}</p>
            {record ? (
              <RatioBar
                done={record.repliedInTime}
                total={record.due}
                target={replyRateTarget(shop.badge)}
                label="Enquiries answered within 48 hours, last 90 days"
              />
            ) : (
              <SectionError id="sell-badge" title="Your reply rate" path={SELL_PATH} />
            )}
            {badgeLine && <p>{badgeLine}</p>}
          </Card>
        </>
      )}

      <Card title="Your listings" action={{ label: "Manage listings", href: myListingsPath() }}>
        {queue ? (
          <SplitBar
            label="Your listings"
            parts={[
              { label: "available", value: queue.listings.available, tone: "navy" },
              { label: "paused", value: queue.listings.paused, tone: "sky-dark" },
              { label: "sold", value: queue.listings.sold, tone: "muted" },
              { label: "drafts", value: queue.listings.drafts, tone: "idle" },
            ]}
          />
        ) : (
          <SectionError id="sell-listings" title="Your listings" path={SELL_PATH} />
        )}
      </Card>

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
