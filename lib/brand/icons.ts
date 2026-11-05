import { MARK, MARK_CENTRE_X, markShapes, NAVY, SKY, WHITE, type MarkCut } from "./cart-mark.ts";

/**
 * The app's icon files (logo spec 3.3): a navy square with the white CampusCart mark and its sky star. The names don't
 * change, so app/manifest.ts and Next's file conventions need nothing. scripts/make-icons.ts writes them.
 */
export type IconSpec = {
  size: number;
  cut: MarkCut;
  /** The mark's drawn width as a share of the icon's. */
  markWidth: number;
  /** Corner radius as a share of the size; 0 is square (Android and iOS round the corners themselves). */
  corner: number;
};

export const ICON_FILES: readonly (IconSpec & { file: string })[] = [
  { file: "public/icons/icon-192.png", size: 192, cut: "full", markWidth: 0.72, corner: 0 },
  { file: "public/icons/icon-512.png", size: 512, cut: "full", markWidth: 0.72, corner: 0 },
  // Maskable: the whole mark inside the central safe circle (radius 40% of the size).
  { file: "public/icons/icon-maskable-512.png", size: 512, cut: "full", markWidth: 0.56, corner: 0 },
  { file: "app/apple-icon.png", size: 180, cut: "full", markWidth: 0.7, corner: 0 },
  // 64 × 64, shown by browsers at 32 or 16: the small cut.
  { file: "app/icon.png", size: 64, cut: "small", markWidth: 0.84, corner: 0.18 },
];

export const FAVICON = {
  file: "app/favicon.ico",
  corner: 0.18,
  images: [
    { size: 16, cut: "small", markWidth: 0.9 },
    { size: 32, cut: "small", markWidth: 0.88 },
    { size: 48, cut: "full", markWidth: 0.84 },
  ],
} as const satisfies { file: string; corner: number; images: readonly Omit<IconSpec, "corner">[] };

/** One icon as an SVG: the mark's drawn box centred in the navy square. */
export function iconSvg({ size, cut, markWidth, corner }: IconSpec): string {
  const { box } = MARK[cut];
  const scale = (size * markWidth) / box.width;
  // Across, centred on the cart's weight (MARK_CENTRE_X), not its box, so it doesn't look pushed right; but the handle
  // keeps at least 6% of the size from the left edge (at 16 to 64 px it would otherwise touch it).
  const x = Math.max(size / 2 - MARK_CENTRE_X * scale, size * 0.06 - box.x * scale);
  const y = (size - box.height * scale) / 2 - box.y * scale;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">` +
    `<rect width="${size}" height="${size}" rx="${size * corner}" fill="${NAVY}"/>` +
    `<g transform="translate(${x} ${y}) scale(${scale})">${markShapes(cut, WHITE, SKY)}</g></svg>`
  );
}
