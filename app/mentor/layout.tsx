import { Suspense } from "react";
import { MentorBar } from "@/components/kit/sections";

/**
 * Mentoring's frame (role views spec 4.1): the mentor bar, for mentors and admins.
 */
export default function MentorLayout({ children }: LayoutProps<"/mentor">) {
  return (
    <div className="section-shell">
      <div className="section-main">{children}</div>
      {/* After the content, so "Skip to content" doesn't land before the bar; CSS places it. */}
      <Suspense fallback={null}>
        <MentorBar />
      </Suspense>
    </div>
  );
}
