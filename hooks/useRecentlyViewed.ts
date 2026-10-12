import { useSyncExternalStore } from "react";
import { getRecentlyViewed, subscribeRecentlyViewed, type ViewedItem } from "@/lib/recently-viewed";

const NONE: readonly ViewedItem[] = [];
const noneOnServer = () => NONE;

export function useRecentlyViewed(): readonly ViewedItem[] {
  return useSyncExternalStore(subscribeRecentlyViewed, getRecentlyViewed, noneOnServer);
}
