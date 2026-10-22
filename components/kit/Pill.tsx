import type { ReactNode } from "react";

export type Tone = "neutral" | "info" | "success" | "warning" | "danger" | "live";

/**
 * One pill for every status (role views spec 5.2), in place of the styles each feature kept. "live" is solid sky with
 * navy text (sky never carries text on white). The words carry the meaning; the tone only adds to them.
 */
export function Pill({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <span className="kit-pill" data-tone={tone}>
      {children}
    </span>
  );
}
