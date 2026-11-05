import { TourNudgeButtons } from "./TourNudgeButtons";

/**
 * Home's one invitation to the tour (guided tour spec 3.1). In the static HTML for everyone; the boot script marks
 * <html data-toured> once it's answered and CSS hides it before first paint, so nothing moves (spec 8).
 */
export function TourNudge() {
  return (
    <aside aria-labelledby="tour-nudge-title" className="tour-nudge">
      <h2 id="tour-nudge-title" className="tour-nudge-title">
        New here?
      </h2>
      <TourNudgeButtons />
    </aside>
  );
}
