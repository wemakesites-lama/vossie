import type { ReactNode } from "react";

type StaffTableProps = {
  caption: string;
  columns: readonly string[];
  rows: ReadonlyArray<{ key: string; cells: readonly ReactNode[] }>;
  /** What to say instead of an empty table. */
  empty: string;
  /**
   * The first cell names its row: a header cell with scope="row" (stage J spec section 7, the numbers' measures and
   * campuses). It's the card's title on phones, so it has no column label.
   */
  rowHeader?: boolean;
};

/**
 * A staff table (spec 2.9 and 4, plan decision 20): a caption and header cells. Below the tablet step each row
 * stacks into a card and each cell shows its column's name in a span screen readers skip, since the header cells
 * already name it. Explicit roles keep it a table for screen readers when CSS changes how it displays.
 */
export function StaffTable({ caption, columns, rows, empty, rowHeader = false }: StaffTableProps) {
  if (rows.length === 0) return <p className="staff-empty">{empty}</p>;
  return (
    <table role="table" className="staff-table">
      <caption className="staff-caption">{caption}</caption>
      <thead role="rowgroup">
        <tr role="row">
          {columns.map((column) => (
            <th key={column} role="columnheader" scope="col">
              {column}
            </th>
          ))}
        </tr>
      </thead>
      <tbody role="rowgroup">
        {rows.map((row) => (
          <tr key={row.key} role="row">
            {row.cells.map((cell, index) =>
              rowHeader && index === 0 ? (
                // Utilities, not new CSS (stage J plan decision 3): a block on phones, a cell from the tablet step,
                // and body text rather than .staff-table th's small muted column-header style.
                <th
                  key={columns[index]}
                  role="rowheader"
                  scope="row"
                  className="block py-1 text-left text-body font-semibold text-ink wide:table-cell wide:py-3"
                >
                  {cell}
                </th>
              ) : (
                <td key={columns[index]} role="cell">
                  <span className="staff-cell-label" aria-hidden="true">
                    {columns[index]}
                  </span>
                  {cell}
                </td>
              ),
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
