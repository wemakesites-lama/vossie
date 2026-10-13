import Image from "next/image";
import type { CSSProperties } from "react";
import { cx } from "@/lib/cx";
import type { ImageRef } from "@/lib/types";

type PhotoProps = {
  image: ImageRef;
  /** CSS aspect ratio, e.g. "1 / 1". Leave it out when CSS sizes the box. */
  ratio?: string;
  /** How wide the photo shows at each breakpoint, for the srcset. Always set it. */
  sizes: string;
  className?: string;
  /** The page's main photo (the hero's first slide, a listing's cover): fetch it straight away and early. */
  priority?: boolean;
};

/** A photo in a box of fixed ratio over a pale preview (spec section 9), so nothing moves while it loads. */
export function Photo({ image, ratio, sizes, className, priority = false }: PhotoProps) {
  return (
    <span className={cx("photo", className)} style={ratio ? ({ "--photo-ratio": ratio } as CSSProperties) : undefined}>
      <Image
        src={image.src}
        alt={image.alt}
        fill
        sizes={sizes}
        loading={priority ? "eager" : "lazy"}
        fetchPriority={priority ? "high" : undefined}
        className="photo-img"
      />
    </span>
  );
}
