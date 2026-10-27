// lib/selling/looking-for-count.ts
import { matchScore, queryWords } from "@/lib/browse/search";
import type { LookingForRequest } from "@/lib/types";

// How many open requests at a campus name a module code (spec 2.3 and decision 15, plan change 4), through browse's own
// word matching. Requests never name their asker, and this gives only a count.

export function requestsNaming(
  requests: readonly Pick<LookingForRequest, "title" | "details" | "campusSlug">[],
  moduleCode: string,
  campusSlug: string,
): number {
  const words = queryWords(moduleCode);
  return requests.filter(
    (request) =>
      request.campusSlug === campusSlug &&
      matchScore({ title: request.title, category: "", seller: "", description: request.details }, words) !== null,
  ).length;
}
