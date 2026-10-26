import { StaffShell } from "@/components/kit/StaffShell";

/** Mentoring's frame (role views spec 4.1, wayfinding spec 3.3): the console's bar for an admin, Mentoring's for a mentor. */
export default function MentorLayout({ children }: LayoutProps<"/mentor">) {
  return <StaffShell>{children}</StaffShell>;
}
