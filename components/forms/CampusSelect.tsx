import type { Campus } from "@/lib/types";

type CampusSelectProps = {
  id: string;
  /** The campus slug to start on, or "" for "Choose your campus". */
  defaultValue: string;
  campuses: readonly Pick<Campus, "slug" | "name">[];
  invalid: boolean;
  describedBy: string | undefined;
};

/** The 13 campuses as a select (accounts spec 3.1 and 3.2). It posts as `campus`. */
export function CampusSelect({ id, defaultValue, campuses, invalid, describedBy }: CampusSelectProps) {
  return (
    <select
      id={id}
      name="campus"
      defaultValue={defaultValue}
      required
      aria-invalid={invalid ? true : undefined}
      aria-describedby={describedBy}
      className="form-input form-select"
    >
      <option value="">Choose your campus</option>
      {campuses.map((campus) => (
        <option key={campus.slug} value={campus.slug}>
          {campus.name}
        </option>
      ))}
    </select>
  );
}
