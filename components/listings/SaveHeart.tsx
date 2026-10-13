"use client";

import { useState } from "react";
import { HeartIcon } from "@/components/icons";
import { useIsSaved } from "@/hooks/useIsSaved";
import { cx } from "@/lib/cx";
import { toggleSaved } from "@/lib/saved";
import { showToast } from "@/lib/toast";

type SaveHeartProps = {
  id: string;
  title: string;
  className?: string;
  /** What the server shows: pressed on the Saved page (shopping spec 5.3), not pressed everywhere else. */
  savedOnServer?: boolean;
};

/** The Save heart (spec 7.8). Saves stay on this device until sign-in exists, and the toast says so. */
export function SaveHeart({ id, title, className, savedOnServer }: SaveHeartProps) {
  const saved = useIsSaved(id, savedOnServer);
  // The pop plays only when someone saves, never when a saved heart first appears.
  const [popping, setPopping] = useState(false);

  function onClick() {
    try {
      const nowSaved = toggleSaved(id);
      setPopping(nowSaved);
      showToast(nowSaved ? "Saved on this device" : "Removed from saved");
    } catch {
      // The cookie didn't take (cookies are blocked). Nothing changed, so there's nothing to roll back.
      showToast("Couldn't update. Try again.");
    }
  }

  return (
    <button
      type="button"
      onClick={onClick}
      onAnimationEnd={() => setPopping(false)}
      aria-label={`Save ${title}`}
      aria-pressed={saved}
      data-pop={popping ? "" : undefined}
      className={cx("save-heart", className)}
    >
      <HeartIcon className="size-5" />
    </button>
  );
}
