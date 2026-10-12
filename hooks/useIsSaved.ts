import { useSyncExternalStore } from "react";
import { isSaved, subscribeSaved } from "@/lib/saved";

const notSavedOnServer = () => false;

/** Whether one listing is saved on this device. A yes-or-no snapshot, so it's safe for useSyncExternalStore. */
export function useIsSaved(id: string): boolean {
  return useSyncExternalStore(subscribeSaved, () => isSaved(id), notSavedOnServer);
}
