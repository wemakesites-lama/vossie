import type { Wanted } from "@/lib/looking-for/match";
import { WANTED_SHOWN } from "@/lib/looking-for/match";
import { isId } from "@/lib/messaging/paths";

// The Published notice's "students are looking" part, in My listings' form state (AI stage G planning decision 8): the
// count and the request ids only. MyListings reads the titles at render, through the cached public reader.

const MOST_STUDENTS = 999;

export function wantedValues(wanted: Wanted | null): Record<string, string> {
  if (!wanted || wanted.students < 1 || wanted.requests.length === 0) return {};
  return { wanted: String(wanted.students), wantedIds: wanted.requests.map((request) => request.id).join(" ") };
}

/** The count and up to three ids, or null when the values hold none, or anything a form could have made up. */
export function readWanted(values: Readonly<Record<string, string>> | undefined): { students: number; ids: string[] } | null {
  const students = Number(values?.wanted);
  if (!Number.isInteger(students) || students < 1 || students > MOST_STUDENTS) return null;
  const ids = (values?.wantedIds ?? "").split(" ").filter(isId).slice(0, WANTED_SHOWN);
  return ids.length > 0 ? { students, ids } : null;
}
