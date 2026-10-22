import { Suspense } from "react";
import { AdminBar } from "@/components/kit/sections";

/**
 * The Hub console's frame (role views spec 4.1): the admin bar, only for admins.
 */
export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <div className="section-shell">
      <div className="section-main">{children}</div>
      {/* After the content, so "Skip to content" doesn't land before the bar; CSS places it. */}
      <Suspense fallback={null}>
        <AdminBar />
      </Suspense>
    </div>
  );
}
