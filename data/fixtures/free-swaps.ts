import type { FreeSwapItem } from "@/lib/types";

const item = (id: string, kind: FreeSwapItem["kind"], title: string, campusSlug: string, categorySlug: string): FreeSwapItem => ({
  id,
  kind,
  title,
  campusSlug,
  image: { src: `/placeholders/listing/${categorySlug}.svg`, alt: title },
});

// Giveaways and swap-only items, newest first. Ids start "fs-" so they never clash with listings.
export const freeSwapItems: readonly FreeSwapItem[] = [
  item("fs-001", "free", "Business Management 1 notes", "midrand", "textbooks-notes"),
  item("fs-002", "swap", "Desk lamp, swap for a kettle", "pretoria", "res-living"),
  item("fs-003", "free", "Res curtains, two panels", "midrand", "res-living"),
  item("fs-004", "swap", "Logo design for a photo shoot", "online", "services"),
  item("fs-005", "free", "Hangers, bag of 20", "bedfordview", "res-living"),
  item("fs-006", "swap", "Calculator for a textbook", "cape-town-mowbray", "tech"),
  item("fs-007", "free", "Highlighters, half used", "east-london", "stationery"),
];
