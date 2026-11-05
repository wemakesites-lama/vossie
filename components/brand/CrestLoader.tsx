import { CartMark } from "./CartMark";

/**
 * The loading sign for a page with nothing to show yet (calm navigation spec 4, layer 1): the CampusCart mark, as in
 * the header's pennant (logo spec 3.2). Hidden for a second, so a fast load never shows it, then it fades in and
 * breathes. The status text appears with it, so a screen reader hears "Loading…" only on a real wait. Only
 * PageFallback uses it: pages with a skeleton already show what's coming. The name stays until the internal-names pass.
 */
export function CrestLoader() {
  return (
    // motion-own: the motion off switches leave its delay alone, so a fast load never shows it (globals.css).
    <div className="crest-loader motion-own">
      <CartMark className="crest-loader-mark" />
      <p role="status" className="crest-loader-status">
        <span className="sr-only">Loading…</span>
      </p>
    </div>
  );
}
