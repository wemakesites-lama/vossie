import { parseNumbersCampus } from "./numbers";

// The admin lists' campus filter (role views spec 7.2, wayfinding spec 3.4): a GET form that adds ?campus=, read as the
// numbers read theirs (stage J spec decision 12), so an unknown or empty value shows every campus. No JavaScript.

export type Place = { slug: string; name: string };

export function readCampusFilter(
  params: Readonly<Record<string, string | string[] | undefined>>,
  campuses: readonly Place[],
): Place | null {
  const slug = parseNumbersCampus(
    params,
    campuses.map((campus) => campus.slug),
  );
  return campuses.find((campus) => campus.slug === slug) ?? null;
}

/** One campus's items, or every item. Something without a campus (a report about something gone) shows only under All. */
export function inCampus<T>(items: readonly T[], chosen: Place | null, campusOf: (item: T) => string | null): T[] {
  return chosen ? items.filter((item) => campusOf(item) === chosen.slug) : [...items];
}
