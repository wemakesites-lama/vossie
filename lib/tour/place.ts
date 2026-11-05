export type Box = { x: number; y: number; width: number; height: number };
export type Size = { width: number; height: number };

const EDGE = 16;
const GAP = 12;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), Math.max(min, max));

/**
 * Where the tour's card goes (guided tour spec 3.2). Phones: full width less 16px a side (CSS sets the width), at the
 * bottom above the tab bar (`bottomInset`), or at the top when the part is in the lower half. From the tablet step:
 * below the part, or above it, lined up with its start edge and kept 16px inside the screen. `target` is the lit
 * window's box, padding included; null when there's nothing to show.
 */
export function placeCard({
  target,
  viewport,
  card,
  wide,
  bottomInset = 0,
}: {
  target: Box | null;
  viewport: Size;
  card: Size;
  wide: boolean;
  bottomInset?: number;
}): { x: number; y: number } {
  if (!wide) {
    const low = target !== null && target.y + target.height / 2 > viewport.height / 2;
    return { x: EDGE, y: low ? EDGE : viewport.height - bottomInset - card.height - EDGE };
  }
  if (!target) return { x: (viewport.width - card.width) / 2, y: (viewport.height - card.height) / 2 };
  const x = clamp(target.x, EDGE, viewport.width - card.width - EDGE);
  const below = target.y + target.height + GAP;
  if (below + card.height <= viewport.height - EDGE) return { x, y: below };
  const above = target.y - GAP - card.height;
  if (above >= EDGE) return { x, y: above };
  return { x, y: clamp(viewport.height - card.height - EDGE, EDGE, viewport.height) };
}
