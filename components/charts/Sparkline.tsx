import "server-only";
import { isTooSmallToChart, sparkline } from "@/lib/charts/scale";
import { NumbersTable } from "./NumbersTable";

type SparklineProps = {
  points: readonly (number | null)[];
  /** One label per point, for the numbers table ("Mon", "12 Oct"). */
  labels: readonly string[];
  /** What the numbers are, as the table's caption. */
  label: string;
  /** The takeaway, one sentence: the figure's name and its visible caption. */
  summary: string;
};

const BOX = { width: 120, height: 32, pad: 3 };

/** A day-by-day trend (role views spec 5.3): a 2px navy line, gaps for missing days, the last value in text. */
export function Sparkline({ points, labels, label, summary }: SparklineProps) {
  if (isTooSmallToChart(points)) {
    // Too little to draw: the takeaway and the values themselves, in words (spec 5.3).
    const values = points.map((point, index) => `${labels[index] ?? index + 1}: ${point ?? "no data"}`).join(", ");
    return (
      <p className="chart-summary">
        {summary} <span className="chart-values">({values})</span>
      </p>
    );
  }
  const line = sparkline(points, BOX);
  const last = points[points.length - 1];
  return (
    <div className="chart">
      <figure role="img" aria-label={summary} className="sparkline">
        <svg viewBox={`0 0 ${BOX.width} ${BOX.height}`} preserveAspectRatio="none" aria-hidden="true">
          {line.segments.map((segment) => (
            <polyline key={segment} points={segment} className="sparkline-line" />
          ))}
          {line.gapEdges.map((edge) => (
            <circle key={`gap-${edge.x}`} cx={edge.x} cy={edge.y} r={2.5} className="sparkline-gap" />
          ))}
          {line.isolated.map((point) => (
            <circle key={`one-${point.x}`} cx={point.x} cy={point.y} r={2.5} className="sparkline-dot" />
          ))}
          {line.last && <circle cx={line.last.x} cy={line.last.y} r={3} className="sparkline-dot" />}
        </svg>
        {typeof last === "number" && <span className="sparkline-last">{last}</span>}
        <figcaption className="chart-summary">{summary}</figcaption>
      </figure>
      <NumbersTable
        caption={label}
        headers={["Day", label]}
        rows={points.map((point, index) => [labels[index] ?? String(index + 1), point === null ? "No data" : String(point)])}
      />
    </div>
  );
}
