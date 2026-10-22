import "server-only";

type Part = { label: string; value: number; tone: "navy" | "sky-dark" | "muted" | "idle" };

/**
 * One stacked bar (role views spec 5.3), for the seller's listing states only. 2px white gaps keep neighbours apart
 * (navy beside sky-dark is 2.8:1); the counts are written underneath in reading order, with no legend.
 */
export function SplitBar({ label, parts }: { label: string; parts: readonly Part[] }) {
  const name = `${label}: ${parts.map((part) => `${part.value} ${part.label}`).join(", ")}`;
  return (
    <figure role="img" aria-label={name} className="split">
      <div className="split-bar">
        {parts
          .filter((part) => part.value > 0)
          .map((part) => (
            <span key={part.label} data-tone={part.tone} style={{ flexGrow: part.value }} />
          ))}
      </div>
      <figcaption className="split-labels">
        {parts.map((part) => (
          <span key={part.label}>
            <b>{part.value}</b> {part.label}
          </span>
        ))}
      </figcaption>
    </figure>
  );
}
