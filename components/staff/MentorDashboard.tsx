import Link from "next/link";
import { badgeLabel } from "@/lib/format";
import { FLAG_WORDS, repliesInTime } from "@/lib/staff/mentor";
import { MENTOR_EXPORT_PATH, mentorShopPath } from "@/lib/staff/paths";
import type { MentoredShop } from "@/lib/types";
import { StaffTable } from "./StaffTable";

type MentorDashboardProps = {
  rows: readonly MentoredShop[];
  /** An admin sees every assigned shop, with its mentor (plan decision 15). */
  showMentor: boolean;
  campusNames: ReadonlyMap<string, string>;
};

/**
 * The mentor dashboard (spec 2.6, plan decision 15): each assigned shop with its badge, the last 14 days' enquiries,
 * replies within 48 hours and confirmed sales, and its flags, linking to its page. Numbers, never messages
 * (FUNCTION-MAP K1). Download CSV is a plain link to a file (plan decision 17).
 */
export function MentorDashboard({ rows, showMentor, campusNames }: MentorDashboardProps) {
  const columns = [
    "Shop",
    "Campus",
    ...(showMentor ? ["Mentor"] : []),
    "Badge",
    "Enquiries (14 days)",
    "Replied within 48 hours",
    "Sales confirmed (14 days)",
    "Flags",
  ];
  return (
    <section aria-labelledby="mentor-shops-title" className="staff-section">
      <h2 id="mentor-shops-title" className="staff-section-title">
        {showMentor ? "Every mentored shop" : "Your sellers"}
      </h2>
      <p>
        The last 14 days, worked out from each shop&apos;s conversations. Mentors see numbers, never messages.{" "}
        <a href={MENTOR_EXPORT_PATH} download className="btn btn-outline text-navy staff-download">
          Download CSV
        </a>
      </p>
      <StaffTable
        caption={`${showMentor ? "Every mentored shop" : "Your sellers"}, A to Z`}
        columns={columns}
        rows={rows.map((row) => ({
          key: row.slug,
          cells: [
            <Link key="shop" href={mentorShopPath(row.slug)} prefetch={false}>
              {row.name}
            </Link>,
            campusNames.get(row.campusSlug) ?? row.campusSlug,
            ...(showMentor ? [row.mentorName] : []),
            row.badge ? badgeLabel(row.badge) : "None",
            String(row.counts.enquiries),
            repliesInTime(row.counts),
            String(row.counts.salesConfirmed),
            row.flags.length === 0 ? "None" : row.flags.map((flag) => FLAG_WORDS[flag].label).join(", "),
          ],
        }))}
        empty="No shops are assigned to you yet. An admin assigns them on each shop's page."
      />
    </section>
  );
}
