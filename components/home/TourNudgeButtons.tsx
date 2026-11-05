import { CloseIcon } from "@/components/icons";

/**
 * The invitation's two buttons (guided tour spec 15). Plain server markup: TourHost, already on every page, answers
 * clicks on `[data-tour-nudge]` (components/tour/TourHost.tsx), because a client component on eleven pages cost every
 * page about 700 B. Either button answers the invitation for good; after that, the menu's "Show me around this page" is
 * the way in.
 */
export function TourNudgeButtons() {
  return (
    <>
      <button type="button" data-tour-nudge="start" className="btn btn-primary">
        Take the tour
      </button>
      <button type="button" data-tour-nudge="close" aria-label="Close the invitation" className="tour-nudge-close">
        <CloseIcon />
      </button>
    </>
  );
}
