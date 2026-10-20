import Link from "next/link";
import type { ReactNode } from "react";
import { STAFF_SECTIONS } from "@/lib/staff/paths";
import { canUse } from "@/lib/staff/roles";
import type { Account } from "@/lib/types";

type StaffFrameProps = {
  account: Pick<Account, "roles">;
  /** The eyebrow: "Admin console", "Hub tools" or "Mentoring". */
  area: string;
  title: string;
  /** The section link this page sits under, marked as the open one. */
  current: string;
  /** The last action's notice, worded (lib/staff/notices.ts), or null. */
  notice: string | null;
  children: ReactNode;
};

/**
 * The staff frame (spec section 3): a heading, a row of links to the sections the account may use, the last action's
 * notice as a status line (spec 4), and the content. Server-rendered, with no client code (spec 2.9). Its links don't
 * prefetch: every staff page reads the session, and Overview runs the badge calculation (plan decision 19).
 */
export function StaffFrame({ account, area, title, current, notice, children }: StaffFrameProps) {
  const sections = STAFF_SECTIONS.filter((section) => canUse(account, section.area));
  return (
    <div className="page staff-page">
      <header className="staff-head">
        <p className="eyebrow">{area}</p>
        <h1 className="staff-title wrap-anywhere">{title}</h1>
      </header>
      <nav aria-label="Staff tools" className="staff-nav">
        <ul>
          {sections.map((section) => (
            <li key={section.href}>
              <Link
                href={section.href}
                prefetch={false}
                aria-current={section.href === current ? "page" : undefined}
                className="staff-nav-link"
              >
                {section.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      {notice && (
        <p role="status" className="form-notice staff-notice">
          {notice}
        </p>
      )}
      <div className="staff-body">{children}</div>
    </div>
  );
}
