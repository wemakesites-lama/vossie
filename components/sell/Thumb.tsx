import { getImageProps } from "next/image";

type ThumbProps = { src: string; alt: string; size?: number };

/**
 * A small square picture on the selling pages (plan decision 13): next/image's resized addresses on a plain <img>,
 * so these pages carry none of its client code (spec section 5).
 */
export function Thumb({ src, alt, size = 96 }: ThumbProps) {
  const { props } = getImageProps({ src, alt, width: size, height: size });
  // eslint-disable-next-line @next/next/no-img-element -- getImageProps gives next/image's addresses; no client code.
  return <img {...props} alt={alt} className="sell-thumb" />;
}
