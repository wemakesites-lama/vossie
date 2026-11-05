import { ACTIONS_A_WEEK, COACH_KINDS, TITLE_MAX, WHY_MAX, type CoachKind } from "./kinds";
import type { Candidate, CoachAction } from "./types";
import { fixedWording } from "./wording";

// The fixed week (AI round two spec 4; I1 planning decision 2): the first candidate of each kind in the catalogue's
// order, three at most, in fixed wording. Stage I2's model path falls back to it. Pure. Expects `candidates` in the
// catalogue's order, as candidatesFor gives them.

export function planWeek(candidates: readonly Candidate[], asOf: string): CoachAction[] {
  const seen = new Set<CoachKind>();
  const picked: Candidate[] = [];
  for (const candidate of candidates) {
    if (seen.has(candidate.kind) || picked.length === ACTIONS_A_WEEK) continue;
    seen.add(candidate.kind);
    picked.push(candidate);
  }
  return picked.map((candidate) => ({ ...candidate, ...fixedWording(candidate), asOf }));
}

const KINDS: readonly string[] = COACH_KINDS;
const TARGETS = ["shop", "listing", "request", "post"];
const isText = (v: unknown, max: number) => typeof v === "string" && v.length > 0 && Array.from(v).length <= max;

/** Stored actions read back (Supabase's jsonb, or anything else): null unless every one has the shape. */
export function asCoachActions(value: unknown): CoachAction[] | null {
  if (!Array.isArray(value) || value.length > ACTIONS_A_WEEK) return null;
  for (const a of value) {
    if (typeof a !== "object" || a === null) return null;
    const { id, kind, target, name, evidence, href, title, why, asOf } = a as Record<string, unknown>;
    if (typeof id !== "string" || typeof kind !== "string" || !KINDS.includes(kind) || !id.startsWith(`${kind}:`)) return null;
    if (typeof target !== "object" || target === null || !TARGETS.includes(String((target as { type?: unknown }).type))) return null;
    if (name !== null && typeof name !== "string") return null;
    if (typeof evidence !== "object" || evidence === null || Object.values(evidence).some((v) => typeof v !== "number")) return null;
    if (typeof href !== "string" || !href.startsWith("/")) return null;
    if (!isText(title, TITLE_MAX) || !isText(why, WHY_MAX) || typeof asOf !== "string" || Number.isNaN(Date.parse(asOf))) return null;
  }
  return value as CoachAction[];
}
