import { StaffShell } from "@/components/kit/StaffShell";

/** The Hub's staff pages share the console's frame (wayfinding spec 3.3). */
export default function EditPostLayout({ children }: LayoutProps<"/hub/[id]/edit">) {
  return <StaffShell>{children}</StaffShell>;
}
