import { Suspense } from "react";
import { SellBar } from "@/components/kit/sections";

/**
 * The selling section's frame (role views spec 4.1): the Selling bar for an account with a shop, in place of the main
 * bar; for anyone else a side panel from the tablet step, and nothing on phones. Streams in: the bar reads the session.
 * `data-bar` reserves the sidebar column from the tablet step before it arrives, so the page never moves right.
 */
export default function SellLayout({ children }: LayoutProps<"/sell">) {
  return (
    <div className="section-shell" data-bar>
      <div className="section-main">{children}</div>
      {/* After the content, so "Skip to content" doesn't land before the bar; CSS places it. */}
      <Suspense fallback={null}>
        <SellBar />
      </Suspense>
    </div>
  );
}
