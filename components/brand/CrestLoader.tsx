import Image from "next/image";
import crestNavy from "@/assets/brand/crest-navy.png";

/**
 * The loading sign for a page with nothing to show yet (calm navigation spec 4, layer 1). Hidden for a second, so a
 * fast load never shows it, then it fades in and breathes. The status text appears with it, so a screen reader hears
 * "Loading…" only on a real wait. Only PageFallback uses it: pages with a skeleton already show what's coming.
 */
export function CrestLoader() {
  return (
    // motion-own: the motion off switches leave its delay alone, so a fast load never shows it (globals.css).
    <div className="crest-loader motion-own">
      {/* 33 × 56 is the display size, as in Pennant: it keeps the srcset to small 1x/2x files. Lazy, so a fallback gone
          before the browser gets to it never fetches the crest. */}
      <Image src={crestNavy} alt="" width={33} height={56} fetchPriority="low" className="crest-loader-mark" />
      <p role="status" className="crest-loader-status">
        <span className="sr-only">Loading…</span>
      </p>
    </div>
  );
}
