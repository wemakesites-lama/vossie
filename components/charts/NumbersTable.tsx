import "server-only";

type NumbersTableProps = {
  caption: string;
  headers: readonly [string, string];
  rows: readonly (readonly [string, string])[];
};

/** A chart's numbers as a table, closed by default (role views spec 5.3): exact values for anyone who wants them. */
export function NumbersTable({ caption, headers, rows }: NumbersTableProps) {
  return (
    <details className="chart-numbers">
      <summary>Show the numbers</summary>
      <table>
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            <th scope="col">{headers[0]}</th>
            <th scope="col">{headers[1]}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([label, value]) => (
            <tr key={label}>
              <th scope="row">{label}</th>
              <td>{value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}
