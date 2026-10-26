import type { ReactNode } from "react";
import { Trail } from "@/components/ui/Trail";
import { trailFor, type TrailOptions } from "@/lib/nav/trail";
import { sectionAt } from "@/lib/staff/sections";
import type { Account } from "@/lib/types";

type StaffFrameProps = {
  account: Pick<Account, "roles">;
  /** The eyebrow, from STAFF_EYEBROW: "Hub console", "Hub tools" (a mentor on the Hub's pages) or "Mentoring". */
  area: string;
  title: string;
  /** One line under the title. A section's front page says what it's for (lib/staff/sections.ts) unless it passes one. */
  lede?: string;
  /** The page's route (`/admin/reports/[id]`), for its breadcrumb trail. */
  route: string;
  /** The trail's segments and names. The page itself is named by its title. */
  trail?: Omit<TrailOptions, "roles">;
  /** The last action's notice, worded (lib/staff/notices.ts), or null. */
  notice: string | null;
  children: ReactNode;
};

/**
 * The staff frame (spec section 3, wayfinding spec 3.3): the breadcrumb trail, a heading, what the section is for, the
 * last action's notice as a status line (spec 4), and the content. The sections' own navigation is the section bar
 * beside it, never a row of links here. Server-rendered, with no client code (spec 2.9).
 */
export function StaffFrame({ account, area, title, lede, route, trail = {}, notice, children }: StaffFrameProps) {
  const crumbs = trailFor(route, { ...trail, names: { ...trail.names, [route]: title }, roles: account.roles });
  const line = lede ?? sectionAt(route)?.purpose;
  return (
    <div className="page staff-page">
      <header className="staff-head">
        <Trail crumbs={crumbs} />
        <p className="eyebrow">{area}</p>
        <h1 className="staff-title wrap-anywhere">{title}</h1>
        {line && <p className="staff-lede">{line}</p>}
      </header>
      {notice && (
        <p role="status" className="form-notice staff-notice">
          {notice}
        </p>
      )}
      <div className="staff-body">{children}</div>
    </div>
  );
}
