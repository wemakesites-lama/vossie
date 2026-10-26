import { StaffShell } from "@/components/kit/StaffShell";

/** The Hub's staff pages share the console's frame (wayfinding spec 3.3). */
export default function HubNewLayout({ children }: LayoutProps<"/hub/new">) {
  return <StaffShell>{children}</StaffShell>;
}
