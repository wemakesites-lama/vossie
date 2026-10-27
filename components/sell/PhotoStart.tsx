import type { ReactNode } from "react";
import { PendingButton } from "@/components/kit/PendingButton";

type PhotoStartProps = {
  prefix: string;
  /** Today's limit is used up (spec 2.4): the button stays, drawn as a secondary button, with a line saying why. */
  limitReached: boolean;
  /** The photo field (PhotoFieldset), drawn inside the card. */
  children: ReactNode;
};

/**
 * The navy "Start with a photo" card on a new listing (photo-to-listing spec 2.1 and 2.2). A fieldset named by its
 * heading, so the card is one group. On a phone it reads heading, photos, button; from the tablet step the photos sit
 * on the left and the heading and button on the right (CSS grid areas). The status line is in the markup but hidden
 * until the button is pending (CSS, spec 2.2). It's visual text only: the button's own live region announces "Reading
 * your photo…" once, and a status role on a line shown from display: none, its text already there, wouldn't be heard.
 */
export function PhotoStart({ prefix, limitReached, children }: PhotoStartProps) {
  return (
    <fieldset className="photo-start" aria-labelledby={`${prefix}-photo-start-title`}>
      <div className="photo-start-head">
        <h2 id={`${prefix}-photo-start-title`} className="photo-start-title">
          Start with a photo
        </h2>
        <p className="photo-start-line">We&apos;ll fill in what we can see. You check it before anything goes live.</p>
      </div>
      <div className="photo-start-photos">{children}</div>
      <div className="photo-start-act">
        {limitReached && (
          <p className="photo-start-line">You can still add photos. Filling in from them is back tomorrow.</p>
        )}
        <PendingButton
          name="intent"
          value="suggest"
          pendingLabel="Reading your photo…"
          className={limitReached ? "photo-start-button photo-start-button-quiet" : "photo-start-button"}
        >
          Fill in from my photo
        </PendingButton>
        <p className="photo-start-status">
          Looking for a title, category and condition. This takes a few seconds.
        </p>
      </div>
    </fieldset>
  );
}
