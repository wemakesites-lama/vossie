import { randomUUID } from "node:crypto";
import { onSupabase } from "@/lib/backend";
import { ONLINE_CAMPUS } from "@/lib/campus";
import { nameKey } from "@/lib/selling/rules";
import type { PickupPoint } from "@/lib/types";
import type { PickupPointRow } from "./rows";
import { sampleStore } from "./store";

// The approved pickup points (staff tools spec 2.3, plan decision 10), moved from the fixture into the store so the
// Hub can add, rename and retire them. Forms offer only the points in use; a listing on a retired point keeps it,
// and its page says "(no longer used)". Retiring is undone by Use it again. Names are unique on their campus,
// compared like shop names (selling's nameKey). Eduvos Online has none. Times come from the caller. On Supabase the
// admin's reads and writes are lib/data/supabase/pickup-points.ts's (C1's reads; C4/C5 plan Task 17's writes).

/** A row as forms and listing pages see it: `retired` only once it is (also the Supabase twin's, lib/data/supabase). */
export function toPoint(row: PickupPointRow): PickupPoint {
  const point = { id: row.id, campusSlug: row.campusSlug, name: row.name };
  return row.retiredAt ? { ...point, retired: true } : point;
}

/** Every point, retired ones included, in the store's order (each campus's together), for the admin page. Copies. */
export async function listPickupPoints(): Promise<PickupPointRow[]> {
  if (onSupabase()) return (await import("./supabase/pickup-points")).listPickupPoints();
  return [...sampleStore().pickupPoints.values()].map((row) => ({ ...row }));
}

/** The points in use: what onboarding, Edit shop and the listing form offer. */
export function pointsInUse(): PickupPoint[] {
  return [...sampleStore().pickupPoints.values()].filter((row) => !row.retiredAt).map(toPoint);
}

/** Any point by id, retired or not, for a listing's page. Null for none. */
export function pickupPointById(id: string | null): PickupPoint | null {
  const row = id ? sampleStore().pickupPoints.get(id) : undefined;
  return row ? toPoint(row) : null;
}

/** Any point by id, retired or not, on either backend: what Rename reads before it checks the name (C4/C5 plan Task 12). */
export async function findPickupPoint(id: string | null): Promise<PickupPoint | null> {
  if (onSupabase()) return (await import("./supabase/pickup-points")).pickupPointById(id);
  return pickupPointById(id);
}

/** A point's name, retired or not, for selling's data export. */
export function pickupPointName(id: string | null): string | null {
  return pickupPointById(id)?.name ?? null;
}

/** Whether another point on the campus has this name, however it's written. `exceptId` is the point being renamed. */
export async function isPointNameTaken(campusSlug: string, name: string, exceptId: string | null): Promise<boolean> {
  if (onSupabase()) return (await import("./supabase/pickup-points")).isPointNameTaken(campusSlug, name, exceptId);
  const key = nameKey(name);
  for (const row of sampleStore().pickupPoints.values()) {
    if (row.id !== exceptId && row.campusSlug === campusSlug && nameKey(row.name) === key) return true;
  }
  return false;
}

/**
 * Adds a point (spec 2.3). Null when the campus already has one by that name, or isn't a campus with points: Eduvos
 * Online has none, and a slug no campus has is refused (the action checks it against the campuses).
 */
export async function addPickupPoint(campusSlug: string, name: string, now: Date): Promise<PickupPointRow | null> {
  if (onSupabase()) return (await import("./supabase/pickup-points")).addPickupPoint(campusSlug, name, now);
  const store = sampleStore();
  const known = [...store.pickupPoints.values()].some((row) => row.campusSlug === campusSlug);
  if (campusSlug === ONLINE_CAMPUS || !known || (await isPointNameTaken(campusSlug, name, null))) return null;
  const row: PickupPointRow = {
    id: `pp-${randomUUID()}`,
    campusSlug,
    name,
    retiredAt: null,
    createdAt: now.toISOString(),
  };
  store.pickupPoints.set(row.id, row);
  return { ...row };
}

/** Renames a point, keeping its id, so listings that use it follow. Its old name; null when nothing changed or it's taken. */
export async function renamePickupPoint(id: string, name: string): Promise<{ before: string } | null> {
  if (onSupabase()) return (await import("./supabase/pickup-points")).renamePickupPoint(id, name);
  const row = sampleStore().pickupPoints.get(id);
  if (!row || row.name === name || (await isPointNameTaken(row.campusSlug, name, id))) return null;
  const before = row.name;
  row.name = name;
  return { before };
}

/** Retire (spec 2.3): forms stop offering it; listings keep it, marked "no longer used". Null when it already was. */
export async function retirePickupPoint(id: string, now: Date): Promise<PickupPointRow | null> {
  if (onSupabase()) return (await import("./supabase/pickup-points")).retirePickupPoint(id, now);
  const row = sampleStore().pickupPoints.get(id);
  if (!row || row.retiredAt) return null;
  row.retiredAt = now.toISOString();
  return { ...row };
}

/** Use it again (plan decision 10): undoes Retire. Null when it's in use already. */
export async function restorePickupPoint(id: string): Promise<PickupPointRow | null> {
  if (onSupabase()) return (await import("./supabase/pickup-points")).restorePickupPoint(id);
  const row = sampleStore().pickupPoints.get(id);
  if (!row || !row.retiredAt) return null;
  row.retiredAt = null;
  return { ...row };
}
