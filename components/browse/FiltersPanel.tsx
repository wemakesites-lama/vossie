import { PAY_LABELS, PRICE_LABELS, clearAllHref } from "@/lib/browse/filters";
import { defaultSort } from "@/lib/browse/query";
import type { BrowseQuery, Campus } from "@/lib/types";

const PRICE_OPTIONS: ReadonlyArray<[value: string, label: string]> = [["", "Any"], ...Object.entries(PRICE_LABELS)];
const PAY_OPTIONS: ReadonlyArray<[value: string, label: string]> = [["", "Any"], ...Object.entries(PAY_LABELS)];

/**
 * The Filters panel (spec 4.4): a plain GET form to /browse, so it works without the app's JavaScript. Hidden fields keep the
 * search, category, deals and a chosen sort. There's no live count: that would need JavaScript. Empty values ("Any")
 * are sent as `price=` and ignored when the link is read.
 */
export function FiltersPanel({ query, campuses }: { query: BrowseQuery; campuses: readonly Campus[] }) {
  const kept: ReadonlyArray<[name: string, value: string | null]> = [
    ["q", query.q],
    ["cat", query.category],
    ["deals", query.deals],
    ["sort", query.sort === defaultSort(query.q) ? null : query.sort],
  ];
  return (
    <form action="/browse" className="filters-panel">
      {kept.map(([name, value]) => value && <input key={name} type="hidden" name={name} value={value} />)}
      <div className="filters-fields">
        <div className="filters-group">
          <label htmlFor="filter-campus" className="filters-label">
            Campus
          </label>
          <select id="filter-campus" name="campus" defaultValue={query.campus} className="filters-select">
            <option value="all">Every campus</option>
            {campuses.map((campus) => (
              <option key={campus.slug} value={campus.slug}>
                {campus.name}
              </option>
            ))}
          </select>
        </div>
        <RadioGroup legend="Price" name="price" options={PRICE_OPTIONS} chosen={query.price ?? ""} />
        <RadioGroup legend="Paid with" name="pay" options={PAY_OPTIONS} chosen={query.pay ?? ""} />
      </div>
      <div className="filters-actions">
        <button type="submit" className="btn btn-primary">
          Show results
        </button>
        {/* A plain <a>, a full page load like the form itself: a client-side navigation would remove the focused
            link along with the panel, and focus would be lost. */}
        <a href={clearAllHref(query)} className="filters-clear">
          Clear
        </a>
      </div>
    </form>
  );
}

type RadioGroupProps = {
  legend: string;
  name: string;
  options: ReadonlyArray<[value: string, label: string]>;
  chosen: string;
};

/** Native radios in a fieldset, so they work everywhere; the pill round each one is just a bigger target. */
function RadioGroup({ legend, name, options, chosen }: RadioGroupProps) {
  return (
    <fieldset className="filters-group">
      <legend className="filters-label">{legend}</legend>
      <div className="filters-options">
        {options.map(([value, label]) => (
          <label key={value || "any"} className="filters-option">
            <input type="radio" name={name} value={value} defaultChecked={value === chosen} />
            {label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
