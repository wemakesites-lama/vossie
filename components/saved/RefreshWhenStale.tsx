"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { readSavedIds } from "@/lib/saved";

/**
 * Keeps Saved up to date when Next shows it again. Next keeps the last few pages and shows a kept one again on a link
 * or Back without asking the server, so a list built before you saved something else would stay out of date. The effect
 * runs each time the page is shown: if the saved cookie no longer matches the ids the server built this list from, it
 * fetches the list again. `savedIds` is the server's ids joined with ".", as in the cookie.
 */
export function RefreshWhenStale({ savedIds }: { savedIds: string }) {
  const router = useRouter();
  useEffect(() => {
    if (readSavedIds().join(".") !== savedIds) router.refresh();
  }, [router, savedIds]);
  return null;
}
