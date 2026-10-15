import type { ReactNode } from "react";

type StaffTableProps = {
  caption: string;
  columns: readonly string[];
  rows: ReadonlyArray<{ key: string; cells: readonly ReactNode[] }>;
  /** What to say instead of an empty table. */
  empty: string;
};

/**
 * A staff table (spec 2.9 and 4, plan decision 20): a caption and header cells. Below the tablet step each row
 * stacks into a card and each cell shows its column's name in a span screen readers skip, since the header cells
 * already name it. Explicit roles keep it a table for screen readers when CSS changes how it displays.
 */
export function StaffTable({ caption, columns, rows, empty }: StaffTableProps) {
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
            {row.cells.map((cell, index) => (
              <td key={columns[index]} role="cell">
                <span className="staff-cell-label" aria-hidden="true">
                  {columns[index]}
                </span>
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
