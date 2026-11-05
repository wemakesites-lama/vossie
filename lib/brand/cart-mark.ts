/**
 * The CampusCart mark (logo spec, docs/superpowers/specs/2026-11-04-campuscart-logo-design.md): a line-drawn cart whose
 * rim is the Eduvos crest's top edge (the handle's grip and the raised right end are its corners, with its dip in the
 * middle), holding the crest's three stars, on wheels that echo the crest's ring.
 *
 * The only drawing of the mark. CartMark (components/brand/CartMark.tsx) draws it in pages; scripts/make-icons.ts draws
 * the app icons, the favicon and the masters in assets/brand from it. It imports nothing, so node can run the script.
 */

export type MarkCut = "full" | "small";

/** A four-point star: its centre and half its height. */
type Star = readonly [x: number, y: number, size: number];

type Drawing = {
  handle: string;
  rim: string;
  /** Stroke width of the handle and the rim. */
  line: number;
  wheels: readonly (readonly [x: number, y: number])[];
  wheelRadius: number;
  wheelLine: number;
  smallStars: readonly Star[];
  bigStar: Star;
  /** What the strokes cover, round caps included: the icons centre this, not the grid. */
  box: { x: number; y: number; width: number; height: number };
};

const MARK_WIDTH = 200;
const MARK_HEIGHT = 175;
export const MARK_VIEWBOX = `0 0 ${MARK_WIDTH} ${MARK_HEIGHT}`;

/**
 * Where the mark's weight sits across: the ink's centre (measured at 112.1 in both cuts), not its box's (101). The
 * handle reaches out left, so a mark centred on its box looks pushed right; it's centred on this instead.
 */
export const MARK_CENTRE_X = 112;

/** The grid moved so its middle is the ink's centre: CartMark's viewBox (with overflow visible, the handle still shows). */
export const MARK_CENTRED_VIEWBOX = `${MARK_CENTRE_X - MARK_WIDTH / 2} 0 ${MARK_WIDTH} ${MARK_HEIGHT}`;

/** The brand's hexes, for generated files only (icons, masters). Pages colour the mark with tokens (CartMark). */
export const NAVY = "#15305d";
export const SKY = "#29abe2";
export const WHITE = "#ffffff";

const HANDLE = "M10 24H32L58 124H174";
const WHEELS = [
  [84, 150],
  [156, 150],
] as const;

export const MARK: Record<MarkCut, Drawing> = {
  // 48 px and larger (spec 2.1).
  full: {
    handle: HANDLE,
    rim: "M38 46H104Q117 46 117 56Q117 46 130 46H170Q182 46 182 32H192L177 106H54",
    line: 11,
    wheels: WHEELS,
    wheelRadius: 11,
    wheelLine: 10,
    smallStars: [
      [88, 79, 11],
      [148, 79, 11],
    ],
    bigStar: [118, 81, 19],
    box: { x: 4, y: 18, width: 194, height: 149 },
  },
  // 32 px and smaller: heavier lines, a deeper rim, one star (spec 2.1).
  small: {
    handle: HANDLE,
    // The right corner ends at 191, not 192, so its round join stays inside the 200 grid (the masters are <img>-safe).
    rim: "M38 46H101Q117 46 117 60Q117 46 133 46H166Q182 46 182 28H191L177 106H54",
    line: 17,
    wheels: WHEELS,
    wheelRadius: 11,
    wheelLine: 14,
    smallStars: [],
    bigStar: [118, 79, 20],
    box: { x: 1, y: 15, width: 199, height: 154 },
  },
};

export function starPath([x, y, s]: Star): string {
  return `M${x} ${y - s}Q${x} ${y} ${x + s} ${y}Q${x} ${y} ${x} ${y + s}Q${x} ${y} ${x - s} ${y}Q${x} ${y} ${x} ${y - s}Z`;
}

/** The mark's shapes as SVG markup, in the 200 × 175 grid: lines and small stars in `lines`, the big star in `star`. */
export function markShapes(cut: MarkCut, lines: string, star: string): string {
  const d = MARK[cut];
  const stroke = (path: string) =>
    `<path d="${path}" fill="none" stroke="${lines}" stroke-width="${d.line}" stroke-linecap="round" stroke-linejoin="round"/>`;
  const wheels = d.wheels.map(
    ([x, y]) => `<circle cx="${x}" cy="${y}" r="${d.wheelRadius}" fill="none" stroke="${lines}" stroke-width="${d.wheelLine}"/>`,
  );
  const small = d.smallStars.length > 0 ? `<path d="${d.smallStars.map(starPath).join("")}" fill="${lines}"/>` : "";
  return [stroke(d.handle), stroke(d.rim), ...wheels, small, `<path d="${starPath(d.bigStar)}" fill="${star}" class="cart-mark-star"/>`].join("");
}

/** A master SVG file of the mark (assets/brand/campuscart-mark-*.svg). */
export function markSvg(cut: MarkCut, lines: string, star: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${MARK_VIEWBOX}" width="${MARK_WIDTH}" height="${MARK_HEIGHT}" overflow="visible">${markShapes(cut, lines, star)}</svg>\n`;
}
