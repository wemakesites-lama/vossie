import { useSyncExternalStore } from "react";
import { getCampusCookieValue, parseCampusChoice, subscribeCampus } from "@/lib/campus";
import type { Campus, CampusChoice } from "@/lib/types";

const unknownOnServer = () => undefined;

/** The visitor's campus choice, or null while it can't be known (server render and hydration). */
export function useCampusChoice(campuses: readonly Pick<Campus, "slug">[]): CampusChoice | null {
  const raw = useSyncExternalStore<string | null | undefined>(
    subscribeCampus,
    getCampusCookieValue,
    unknownOnServer,
  );
  return raw === undefined ? null : parseCampusChoice(raw, campuses);
}
