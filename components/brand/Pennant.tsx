import Image from "next/image";
import crestNavy from "@/assets/brand/crest-navy.png";
import { cx } from "@/lib/cx";
import { CartMark } from "./CartMark";

type PennantProps = {
  /** "header" hangs from the header bar; "small" is the footer lockup (a white pennant with the navy crest). */
  size?: "header" | "small";
  className?: string;
};

/**
 * The header's navy varsity pennant with a white edge (spec section 4), holding the CampusCart mark (logo spec 3.1),
 * and the footer's small white pennant with the navy Eduvos crest (logo spec 3.4). A Server Component: the header takes
 * it as a slot from the layout. Decorative: the link or button around it carries the accessible name.
 */
export function Pennant({ size = "header", className }: PennantProps) {
  if (size === "small") {
    // The footer lockup from the approved mockup: a white pennant with the navy crest, no edge.
    return (
      <span aria-hidden="true" className={cx("pennant-mini", className)}>
        <Image src={crestNavy} alt="" width={13} height={22} loading="lazy" className="pennant-mini-crest" />
      </span>
    );
  }

  return (
    <span aria-hidden="true" className={cx("pennant", className)}>
      <span className="pennant-shadow">
        <span className="pennant-shape" />
      </span>
      <span className="pennant-shape pennant-back" />
      <span className="pennant-shape pennant-pen">
        {/* motion-own: it breathes while a tapped link waits (calm navigation), and keeps that 150 ms delay under
            reduced motion and data saver, where it only dims (globals.css). Sized in CSS (.pennant-crest). */}
        <CartMark sky className="pennant-crest motion-own" />
      </span>
    </span>
  );
}
