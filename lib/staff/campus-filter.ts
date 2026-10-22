import type { LinkTab } from "@/components/ui/LinkTabs";
import { parseNumbersCampus } from "./numbers";

// The admin lists' campus chips (role views spec 7.2, N3 plan decision 10): links that add ?campus=, read as the numbers
// read theirs (stage J spec decision 12), so an unknown or empty value shows every campus. No form, no JavaScript.

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

export function campusFilterPath(path: string, slug: string | null): string {
  return slug ? `${path}?campus=${encodeURIComponent(slug)}` : path;
}

/** "All campuses", then each campus in the fixtures' order. */
export function campusFilterTabs(path: string, campuses: readonly Place[]): LinkTab[] {
  return [
    { key: "all", label: "All campuses", href: path },
    ...campuses.map((campus) => ({ key: campus.slug, label: campus.name, href: campusFilterPath(path, campus.slug) })),
  ];
}

/** One campus's items, or every item. Something without a campus (a report about something gone) shows only under All. */
export function inCampus<T>(items: readonly T[], chosen: Place | null, campusOf: (item: T) => string | null): T[] {
  return chosen ? items.filter((item) => campusOf(item) === chosen.slug) : [...items];
}
