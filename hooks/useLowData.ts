import { useSyncExternalStore } from "react";
import { getLowData, subscribeLowData } from "@/lib/low-data";

const offOnServer = () => false;

export function useLowData(): boolean {
  return useSyncExternalStore(subscribeLowData, getLowData, offOnServer);
}
