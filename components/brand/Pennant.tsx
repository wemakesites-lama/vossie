import Image from "next/image";
import crestWhite from "@/assets/brand/crest-white.png";
import { cx } from "@/lib/cx";

type PennantProps = {
  /** "header" hangs from the header bar; "small" is the footer lockup. */
  size?: "header" | "small";
  className?: string;
};

/**
 * The Eduvos crest in a navy varsity pennant with a white edge (spec section 4).
 * Decorative: the link or button around it carries the accessible name.
 */
export function Pennant({ size = "header", className }: PennantProps) {
  return (
    <span aria-hidden="true" className={cx("pennant", size === "small" && "pennant--small", className)}>
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
          loading={size === "header" ? "eager" : "lazy"}
          className="pennant-crest"
        />
      </span>
    </span>
  );
}
