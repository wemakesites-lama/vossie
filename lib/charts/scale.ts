// The charts' arithmetic (role views spec 5.3), kept pure so it's tested on its own. Bars start at 0; missing values
// (null) are gaps, never zeros.

/** A bar's length as a share of the largest value, 0 to 1. */
export function barShare(value: number, max: number): number {
  if (max <= 0) return 0;
  return Math.min(1, Math.max(0, value / max));
}

/**
 * Fewer than 2 known points, or a largest value of 3 or under: write the numbers instead of a chart (spec 5.3). Small
 * multiples pass their shared largest value (`max`), so they're all charts or all words (N4 plan decision 8).
 */
export function isTooSmallToChart(points: readonly (number | null)[], max?: number): boolean {
  const known = points.filter((point): point is number => point !== null);
  return known.length < 2 || (max ?? Math.max(...known)) <= 3;
}

type Box = { width: number; height: number; pad: number };
type Point = { x: number; y: number };

const round = (n: number) => Math.round(n * 100) / 100;

/**
 * A sparkline's polyline segments in a width × height box: one segment per unbroken run of known points, the edges
 * of each gap (drawn as open circles), and the last point (drawn as a dot) when the last day is known. `sharedMax` is
 * the largest value across a set of small multiples, so they share one scale (N4 plan decision 8).
 */
export function sparkline(points: readonly (number | null)[], { width, height, pad }: Box, sharedMax?: number) {
  const known = points.filter((point): point is number => point !== null);
  const max = sharedMax ?? (known.length ? Math.max(...known) : 0);
  const step = points.length > 1 ? (width - 2 * pad) / (points.length - 1) : 0;
  const at = (value: number, index: number): Point => ({
    x: round(pad + index * step),
    y: round(height - pad - (max > 0 ? (value / max) * (height - 2 * pad) : 0)),
  });

  // Unbroken runs of known points, each with whether a gap sits before and after it.
  const runs: { points: Point[]; gapBefore: boolean; gapAfter: boolean }[] = [];
  points.forEach((value, index) => {
    if (value === null) return;
    const point = at(value, index);
    const previous = runs[runs.length - 1];
    if (previous && points[index - 1] !== null && index > 0) previous.points.push(point);
    else runs.push({ points: [point], gapBefore: index > 0 && points[index - 1] === null, gapAfter: false });
  });
  // Runs are separated by nulls, so every run but the last has a gap after it.
  runs.forEach((run, i) => {
    run.gapAfter = i < runs.length - 1 || points[points.length - 1] === null;
  });

  const segments: string[] = [];
  const gapEdges: Point[] = [];
  // A known value with gaps on both sides draws no line: it's a filled dot, not a "missing next to here" circle.
  const isolated: Point[] = [];
  for (const run of runs) {
    if (run.points.length === 1 && (run.gapBefore || run.gapAfter)) {
      isolated.push(run.points[0]);
      continue;
    }
    segments.push(run.points.map((p) => `${p.x},${p.y}`).join(" "));
    if (run.gapBefore) gapEdges.push(run.points[0]);
    if (run.gapAfter) gapEdges.push(run.points[run.points.length - 1]);
  }

  const lastValue = points[points.length - 1];
  const last = lastValue === null || lastValue === undefined ? null : at(lastValue, points.length - 1);
  return { segments, gapEdges, isolated, last };
}
