import type { Place } from "@/lib/staff/campus-filter";
import { FilterForm } from "./FilterForm";

/** A list's campus filter (role views spec 7.2, wayfinding spec 3.4): a select and Filter, the campus in the address. */
export function CampusFilter({ path, campuses, chosen }: { path: string; campuses: readonly Place[]; chosen: Place | null }) {
  return (
    <FilterForm
      id={`campus-filter${path.replaceAll("/", "-")}`}
      path={path}
      label="Filter by campus"
      fields={[
        {
          name: "campus",
          label: "Campus",
          options: [{ value: "", label: "All campuses" }, ...campuses.map((campus) => ({ value: campus.slug, label: campus.name }))],
          chosen: chosen?.slug ?? "",
        },
      ]}
    />
  );
}
