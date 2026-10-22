import { Suspense } from "react";
import { SellBar } from "@/components/kit/sections";

/**
 * The selling section's frame (role views spec 4.1): the Selling bar for an account with a shop, in place of the main
 * bar; nothing for anyone else. Streams in: the bar reads the session.
 */
export default function SellLayout({ children }: LayoutProps<"/sell">) {
  return (
    <div className="section-shell">
      <div className="section-main">{children}</div>
      {/* After the content, so "Skip to content" doesn't land before the bar; CSS places it. */}
      <Suspense fallback={null}>
        <SellBar />
      </Suspense>
    </div>
  );
}
