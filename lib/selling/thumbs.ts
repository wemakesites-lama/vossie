import { getImageProps } from "next/image";

/**
 * A small picture's address for the photo field (plan decision 13): next/image's resized copy of a stored photo, or a
 * placeholder as it is, worked out on the server so the client component carries none of next/image's code. `size`
 * is the CSS width; the address covers 2x screens.
 */
export function thumbSrc(src: string, size = 96): string {
  return getImageProps({ src, alt: "", width: size, height: size }).props.src;
}
