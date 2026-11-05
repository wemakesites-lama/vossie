import { MARK, MARK_CENTRED_VIEWBOX, starPath, type MarkCut } from "@/lib/brand/cart-mark";
import { cx } from "@/lib/cx";

type CartMarkProps = {
  /** "full" from 48 px up; "small" below (logo spec 2.1). */
  cut?: MarkCut;
  /** The big star in sky. Only on a band (the pennant): sky never sits on white (logo spec 2.3). */
  sky?: boolean;
  className?: string;
};

/**
 * The CampusCart mark, inline, in the text colour (`currentColor`), so each theme colours it with no image swap.
 * A Server Component: keep it out of client components (the header takes the pennant as a slot), so it costs no JS.
 * Decorative: the link or status around it carries the words. Size it with CSS.
 */
export function CartMark({ cut = "full", sky = false, className }: CartMarkProps) {
  const d = MARK[cut];
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      // Centred on the cart's weight, not its box, so it sits in the middle of the pennant to the eye.
      viewBox={MARK_CENTRED_VIEWBOX}
      overflow="visible"
      className={cx("cart-mark", sky && "cart-mark--sky", className)}
    >
      <g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
        <path d={d.handle} strokeWidth={d.line} />
        <path d={d.rim} strokeWidth={d.line} />
        {d.wheels.map(([x, y]) => (
          <circle key={x} cx={x} cy={y} r={d.wheelRadius} strokeWidth={d.wheelLine} />
        ))}
      </g>
      {d.smallStars.length > 0 && <path d={d.smallStars.map(starPath).join("")} fill="currentColor" />}
      <path d={starPath(d.bigStar)} fill="currentColor" className="cart-mark-star" />
    </svg>
  );
}
