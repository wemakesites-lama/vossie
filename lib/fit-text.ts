/**
 * The font size that makes text exactly fill `targetWidth`, given its width measured at `baseSize`.
 * Text width grows in proportion to font size, so one measurement is enough.
 * Rounded down to 0.1px so the text never overflows.
 */
export function fitFontSize(measuredWidth: number, baseSize: number, targetWidth: number): number {
  if (measuredWidth <= 0 || targetWidth <= 0) return baseSize;
  return Math.floor(((baseSize * targetWidth) / measuredWidth) * 10) / 10;
}
