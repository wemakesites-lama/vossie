"use client";

import { useEffect } from "react";
import { recordRecentlyViewed, type ViewedItem } from "@/lib/recently-viewed";

/** Remembers a listing page on this device, for the homepage's "Pick up where you left off" (spec 7.4). */
export function RecordRecentlyViewed({ item }: { item: ViewedItem }) {
  useEffect(() => {
    recordRecentlyViewed(item);
  }, [item]);
  return null;
}
