import { AlertIcon, ChartIcon, ClockIcon, MapPinIcon, ShieldIcon, TrendingIcon, UserIcon } from "@/components/icons";
import { ListRow } from "@/components/kit/ListRow";
import type { ReactNode } from "react";
import { ADMIN_MORE_SECTIONS, STAFF_GROUPS, STAFF_SECTIONS } from "@/lib/staff/sections";

const ICONS: Readonly<Record<string, ReactNode>> = {
  hidden: <AlertIcon />,
  mentoring: <UserIcon />,
  numbers: <ChartIcon />,
  audit: <ClockIcon />,
  featured: <TrendingIcon />,
  points: <MapPinIcon />,
  staff: <ShieldIcon />,
};

/**
 * The admin bar's More on phones (role views spec 4.1, wayfinding spec 3.3): the sections the five tabs don't hold,
 * under the same headings as the sidebar, each with what it's for. Hidden also says how much is hidden now.
 */
export function AdminMore({ hidden }: { hidden: { listings: number; requests: number } }) {
  const total = hidden.listings + hidden.requests;
  const more = STAFF_SECTIONS.filter((section) => ADMIN_MORE_SECTIONS.includes(section.href));
  return (
    <>
      {STAFF_GROUPS.map((group) => {
        const sections = more.filter((section) => section.group === group.key);
        if (sections.length === 0) return null;
        const headingId = `more-${group.key}`;
        return (
          <section key={group.key} aria-labelledby={headingId} className="staff-more-group">
            <h2 id={headingId} className="staff-more-heading">
              {group.label}
            </h2>
            <ul aria-labelledby={headingId} className="kit-card">
              {sections.map((section) => (
                <ListRow
                  key={section.key}
                  href={section.href}
                  lead={{ kind: "icon", icon: ICONS[section.key] }}
                  title={section.label}
                  detail={section.key === "hidden" ? `${total === 0 ? "Nothing hidden" : `${total} hidden now`}. ${section.purpose}` : section.purpose}
                />
              ))}
            </ul>
          </section>
        );
      })}
    </>
  );
}
