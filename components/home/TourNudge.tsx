import { TourNudgeButtons } from "./TourNudgeButtons";

/**
 * The tour's one-time invitation (guided tour spec 15): a card in the bottom corner of the first toured page a visitor
 * sees. Every toured page renders it inside its own `data-tour-page` element, so it goes with its page (Next keeps
 * pages you've left in the DOM, hidden) and never shows where there's no tour. In the static HTML; the boot script
 * marks <html data-toured> once it's answered and CSS hides it before first paint, so nothing moves (spec 8). It has no
 * client code: TourHost answers its buttons. Named,
 * not labelled by a heading: a page Next keeps hidden holds a copy, and ids would repeat.
 */
export function TourNudge() {
  return (
    <aside aria-label="Tour invitation" className="tour-nudge">
      <p className="tour-nudge-title">New here?</p>
      <TourNudgeButtons />
    </aside>
  );
}
