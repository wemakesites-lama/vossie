import "server-only";
import type { CSSProperties } from "react";
import { barShare } from "@/lib/charts/scale";

type RatioBarProps = {
  done: number;
  total: number;
  /** The goal as a share, 0 to 1, drawn as a navy tick. */
  target?: number;
  label: string;
};

/** "12 of 15" as a bar (role views spec 5.3): sky-dark fill (4.7:1) on a panel track, an optional navy target tick. */
export function RatioBar({ done, total, target, label }: RatioBarProps) {
  if (total === 0) return <p className="ratio-words">None due yet</p>;
  const words = `${done} of ${total}`;
  return (
    <div className="ratio">
      <div
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={done}
        aria-valuetext={words}
        className="ratio-track"
      >
        <span className="ratio-fill" style={{ "--v": String(barShare(done, total)) } as CSSProperties} />
        {target !== undefined && <span className="ratio-target" style={{ "--t": String(target) } as CSSProperties} />}
      </div>
      <p className="ratio-words">{words}</p>
    </div>
  );
}
