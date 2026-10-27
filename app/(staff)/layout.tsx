import type { ReactNode } from "react";
import { StaffShell } from "@/components/kit/StaffShell";

/**
 * Every staff page's frame (role views spec 4.1, wayfinding spec 3.3): the console's bar for an admin, Mentoring's for
 * a mentor. One layout for the console, Mentoring and the Hub's tools, so moving between them keeps the bar mounted;
 * with a layout each, the bar's <Suspense> started again and the bar dropped out for about a second on a slow phone.
 */
export default function StaffLayout({ children }: { children: ReactNode }) {
  return <StaffShell>{children}</StaffShell>;
}
