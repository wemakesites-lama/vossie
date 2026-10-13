import { useSyncExternalStore } from "react";
import { isSaved, subscribeSaved } from "@/lib/saved";

/**
 * Whether one listing is saved on this device. A yes-or-no snapshot, so it's safe for useSyncExternalStore.
 * `savedOnServer` is what the server renders: "not saved", except on the Saved page, whose cards are all saved
 * (shopping spec 5.3).
 */
export function useIsSaved(id: string, savedOnServer = false): boolean {
  return useSyncExternalStore(subscribeSaved, () => isSaved(id), () => savedOnServer);
}
