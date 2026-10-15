import Link from "next/link";
import { ADMIN_REPORTS_PATH, ADMIN_SELLERS_PATH, HUB_MANAGE_PATH } from "@/lib/staff/paths";

type AdminOverviewProps = {
  waiting: number;
  openReports: number;
  openSlots: number;
  /** How many shops' badges the calculation Overview just ran changed (spec 2.7, plan decision 8). */
  badgesChanged: number;
};

/**
 * Overview (spec 2.3): what needs attention, with links, and the trust badges worked out as the page rendered (spec
 * 2.7). Public pages show a changed badge when their cached data next revalidates, within 15 minutes, or at the next
 * write that expires sellers (plan decision 8). The words are samples for Lama to change.
 */
export function AdminOverview({ waiting, openReports, openSlots, badgesChanged }: AdminOverviewProps) {
  const items = [
    { id: "waiting", count: waiting, label: "Sellers waiting for approval", href: ADMIN_SELLERS_PATH, action: "Review sellers" },
    { id: "reports", count: openReports, label: "Open reports", href: ADMIN_REPORTS_PATH, action: "Review reports" },
    {
      id: "slots",
      count: openSlots,
      label: "Slot requests waiting for an answer",
      href: `${HUB_MANAGE_PATH}#hub-queue`,
      action: "Answer slot requests",
    },
  ];
  const changed =
    badgesChanged === 0
      ? "None changed."
      : `${badgesChanged} ${badgesChanged === 1 ? "shop's badge" : "shops' badges"} changed.`;
  return (
    <>
      <section aria-labelledby="admin-attention-title" className="staff-section">
        <h2 id="admin-attention-title" className="staff-section-title">
          Needs attention
        </h2>
        <ul className="staff-counts">
          {items.map((item) => (
            <li key={item.id} className="staff-count">
              <p className="staff-count-number">{item.count}</p>
              <p className="staff-count-label">{item.label}</p>
              <Link href={item.href} prefetch={false} className="staff-row-action">
                {item.action}
              </Link>
            </li>
          ))}
        </ul>
      </section>
      <section aria-labelledby="admin-badges-title" className="staff-section">
        <h2 id="admin-badges-title" className="staff-section-title">
          Trust badges
        </h2>
        <p>
          Worked out just now from each shop&apos;s conversations, by the rules on the trust page. {changed} Buyers see a
          change within 15 minutes. Sample shops no account owns keep their sample badges.
        </p>
      </section>
    </>
  );
}
