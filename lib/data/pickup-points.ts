import { randomUUID } from "node:crypto";
import { ONLINE_CAMPUS } from "@/lib/campus";
import { nameKey } from "@/lib/selling/rules";
import type { PickupPoint } from "@/lib/types";
import type { PickupPointRow } from "./rows";
import { sampleStore } from "./store";

// The approved pickup points (staff tools spec 2.3, plan decision 10), moved from the fixture into the store so the
// Hub can add, rename and retire them. Forms offer only the points in use; a listing on a retired point keeps it,
// and its page says "(no longer used)". Retiring is undone by Use it again. Names are unique on their campus,
// compared like shop names (selling's nameKey). Eduvos Online has none. Times come from the caller. Each write checks
// and changes the store with no await in between (plan amendment 19).

function toPoint(row: PickupPointRow): PickupPoint {
  const point = { id: row.id, campusSlug: row.campusSlug, name: row.name };
  return row.retiredAt ? { ...point, retired: true } : point;
}

/** Every point, retired ones included, in the store's order (each campus's together), for the admin page. Copies. */
export async function listPickupPoints(): Promise<PickupPointRow[]> {
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

/** A point's name, retired or not, for selling's data export. */
export function pickupPointName(id: string | null): string | null {
  return pickupPointById(id)?.name ?? null;
}

/**
 * The points a listing may use (plan amendment 13): its shop's points in use, then the listing's own point when it has
 * been retired since, so the listing can be saved as it is. Any other retired point, or one in use that the shop has
 * dropped, isn't offered (selling's rule: one of the shop's points).
 */
export function pointsForListing(shopPointIds: readonly string[], currentId: string | null): PickupPoint[] {
  const shops = pointsInUse().filter((point) => shopPointIds.includes(point.id));
  const current = pickupPointById(currentId);
  return current?.retired ? [...shops, current] : shops;
}

/** The ones among a shop's or a draft's saved points that have been retired, for Edit shop and the wizard to say so. */
export function retiredPoints(ids: readonly string[]): PickupPoint[] {
  return ids.flatMap((id) => {
    const point = pickupPointById(id);
    return point?.retired ? [point] : [];
  });
}

/** Whether another point on the campus has this name, however it's written. Synchronous, for the writes below. */
function nameTaken(campusSlug: string, name: string, exceptId: string | null): boolean {
  const key = nameKey(name);
  for (const row of sampleStore().pickupPoints.values()) {
    if (row.id !== exceptId && row.campusSlug === campusSlug && nameKey(row.name) === key) return true;
  }
  return false;
}

/** Whether another point on the campus has this name, however it's written. `exceptId` is the point being renamed. */
export async function isPointNameTaken(campusSlug: string, name: string, exceptId: string | null): Promise<boolean> {
  return nameTaken(campusSlug, name, exceptId);
}

/**
 * Adds a point (spec 2.3). Null when the campus already has one by that name, or isn't a campus with points: Eduvos
 * Online has none, and a slug no campus has is refused (the action checks it against the campuses too).
 */
export async function addPickupPoint(campusSlug: string, name: string, now: Date): Promise<PickupPointRow | null> {
  const store = sampleStore();
  const known = [...store.pickupPoints.values()].some((row) => row.campusSlug === campusSlug);
  if (campusSlug === ONLINE_CAMPUS || !known || nameTaken(campusSlug, name, null)) return null;
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
  const row = sampleStore().pickupPoints.get(id);
  if (!row || row.name === name || nameTaken(row.campusSlug, name, id)) return null;
  const before = row.name;
  row.name = name;
  return { before };
}

/** Retire (spec 2.3): forms stop offering it; listings keep it, marked "no longer used". Null when it already was. */
export async function retirePickupPoint(id: string, now: Date): Promise<PickupPointRow | null> {
  const row = sampleStore().pickupPoints.get(id);
  if (!row || row.retiredAt) return null;
  row.retiredAt = now.toISOString();
  return { ...row };
}

/** Use it again (plan decision 10): undoes Retire. Null when it's in use already. */
export async function restorePickupPoint(id: string): Promise<PickupPointRow | null> {
  const row = sampleStore().pickupPoints.get(id);
  if (!row || !row.retiredAt) return null;
  row.retiredAt = null;
  return { ...row };
}
