import { useSyncExternalStore } from "react";
import { getSavedCount, subscribeSaved } from "@/lib/saved";

const noneOnServer = () => 0;

export function useSavedCount(): number {
  return useSyncExternalStore(subscribeSaved, getSavedCount, noneOnServer);
}
