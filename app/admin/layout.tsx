import { Suspense } from "react";
import { AdminBar } from "@/components/kit/sections";

/**
 * The Hub console's frame (role views spec 4.1): the admin bar, only for admins.
 * `data-bar` reserves the sidebar column from the tablet step before the bar streams in, so the page never moves
 * right (an empty column for anyone the section isn't for).
 */
export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <div className="section-shell" data-bar>
      <div className="section-main">{children}</div>
      {/* After the content, so "Skip to content" doesn't land before the bar; CSS places it. */}
      <Suspense fallback={null}>
        <AdminBar />
      </Suspense>
    </div>
  );
}
