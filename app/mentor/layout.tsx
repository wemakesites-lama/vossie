import { Suspense } from "react";
import { MentorBar } from "@/components/kit/sections";

/**
 * Mentoring's frame (role views spec 4.1): the mentor bar, for mentors and admins.
 * `data-bar` reserves the sidebar column from the tablet step before the bar streams in, so the page never moves
 * right (an empty column for anyone the section isn't for).
 */
export default function MentorLayout({ children }: LayoutProps<"/mentor">) {
  return (
    <div className="section-shell" data-bar>
      <div className="section-main">{children}</div>
      {/* After the content, so "Skip to content" doesn't land before the bar; CSS places it. */}
      <Suspense fallback={null}>
        <MentorBar />
      </Suspense>
    </div>
  );
}
