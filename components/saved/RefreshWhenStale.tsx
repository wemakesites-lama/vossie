"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { forgetSaved, readSavedIds } from "@/lib/saved";

/**
 * Two jobs, both done each time Saved is shown. Next keeps the last few pages and shows a kept one again on a link or
 * Back without asking the server, so the effect runs on every showing, not just the first.
 *
 * 1. Forget ids whose listings are gone. `savedIds` is the ids the server read from the cookie and `shownIds` the ids
 *    of the listings it actually showed, both joined with "." and in order. An id in the first and not the second has
 *    no listing, and no card to tap to remove it, so it would sit in the cookie and the header's count for good:
 *    `forgetSaved` removes it.
 * 2. Keep the list up to date. If the cookie still doesn't match what was shown (something was saved or removed since
 *    the server built the list, or the forgetting didn't take), fetch the list again. A list built before you saved
 *    something else would otherwise stay out of date.
 */
export function RefreshWhenStale({ savedIds, shownIds }: { savedIds: string; shownIds: string }) {
  const router = useRouter();
  useEffect(() => {
    const shown = new Set(shownIds.split(".").filter(Boolean));
    const gone = savedIds.split(".").filter((id) => id && !shown.has(id));
    if (gone.length > 0) forgetSaved(gone);
    if (readSavedIds().join(".") !== shownIds) router.refresh();
  }, [router, savedIds, shownIds]);
  return null;
}
