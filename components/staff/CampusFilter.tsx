import { LinkTabs } from "@/components/ui/LinkTabs";
import { campusFilterTabs, type Place } from "@/lib/staff/campus-filter";

/** A list's campus chips (role views spec 7.2): links, never prefetched, the chosen one marked. */
export function CampusFilter({ path, campuses, chosen }: { path: string; campuses: readonly Place[]; chosen: Place | null }) {
  return <LinkTabs label="Filter by campus" look="chips" tabs={campusFilterTabs(path, campuses)} current={chosen?.slug ?? "all"} />;
}
