import Link from "next/link";

export type FilterField = {
  /** The query's name (`campus`, `staff`, `kind`). An empty value means every one, as the readers take it. */
  name: string;
  label: string;
  /** The first option is "every one", with an empty value. */
  options: readonly { value: string; label: string }[];
  /** The value in the address now, or "" for every one. */
  chosen: string;
};

/**
 * A staff list's filters (wayfinding spec 3.4): a labelled select for each and a Filter button, posted as a plain GET
 * form, so the filter stays in the address and there's no JavaScript. Under it, what's shown in words, with Clear
 * whenever anything is chosen. `id` keeps the fields' ids apart from other pages' kept in the page by Next.
 */
export function FilterForm({ id, path, label, fields }: { id: string; path: string; label: string; fields: readonly FilterField[] }) {
  const named = (field: FilterField) => field.options.find((option) => option.value === field.chosen) ?? field.options[0];
  const anyChosen = fields.some((field) => field.chosen !== "");
  return (
    <div className="staff-filter">
      <form method="get" action={path} aria-label={label} className="staff-filter-form">
        {fields.map((field) => {
          const fieldId = `${id}-${field.name}`;
          return (
            <div key={field.name} className="form-field">
              <label htmlFor={fieldId} className="form-label">
                {field.label}
              </label>
              <select id={fieldId} name={field.name} defaultValue={field.chosen} className="form-input form-select">
                {field.options.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          );
        })}
        <button type="submit" className="btn btn-outline text-navy">
          Filter
        </button>
      </form>
      <p className="staff-filter-summary">
        Showing {fields.map((field) => named(field).label).join(" · ")}
        {anyChosen && (
          <>
            {" · "}
            <Link href={path} prefetch={false} className="staff-filter-clear">
              Clear filters
            </Link>
          </>
        )}
      </p>
    </div>
  );
}
