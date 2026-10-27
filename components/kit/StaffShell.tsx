import { Suspense, type ReactNode } from "react";
import { StaffBar } from "@/components/kit/sections";

/**
 * The frame for every staff page (`app/(staff)/layout.tsx`: the console, Mentoring and the Hub's tools), so the
 * console's sidebar is the same on every staff page (wayfinding spec 3.3): the admin bar for an admin, Mentoring's
 * for a mentor. `data-bar` reserves the
 * sidebar column from the tablet step before the bar streams in, so the page never moves right.
 */
export function StaffShell({ children }: { children: ReactNode }) {
  return (
    <div className="section-shell" data-bar>
      <div className="section-main">{children}</div>
      {/* After the content, so "Skip to content" doesn't land before the bar; CSS places it. */}
      <Suspense fallback={null}>
        <StaffBar />
      </Suspense>
    </div>
  );
}
