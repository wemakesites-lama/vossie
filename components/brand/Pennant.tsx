import Image from "next/image";
import crestNavy from "@/assets/brand/crest-navy.png";
import crestWhite from "@/assets/brand/crest-white.png";
import { cx } from "@/lib/cx";

type PennantProps = {
  /** "header" hangs from the header bar; "small" is the footer lockup (a white pennant with the navy crest). */
  size?: "header" | "small";
  className?: string;
};

/**
 * The Eduvos crest in a navy varsity pennant with a white edge (spec section 4).
 * Decorative: the link or button around it carries the accessible name.
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
        <Image
          src={crestWhite}
          alt=""
          width={36}
          height={60}
          loading="eager"
          className="pennant-crest"
        />
      </span>
    </span>
  );
}
