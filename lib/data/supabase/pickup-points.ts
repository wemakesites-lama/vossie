import "server-only";
import { nameKey } from "@/lib/selling/rules";
import { Refused } from "../refused";
import type { PickupPointRow } from "../rows";
import type * as Sample from "../pickup-points";
import { toPoint } from "../pickup-points";
import { tagPickupPoints } from "../tags";
import { type DbClient, forPublic, forViewer } from "./clients";
import { type AsyncTwin, iso, selectAll } from "./rows";

// Pickup points on Supabase (2b plan Task 14, decision 14): the sample module's public reads, over the pickup_points
// table, which anyone may read, retired points included. The Hub's writes (C4/C5 plan Task 17) are the four staff
// functions, with the admin's session: each writes its audit entry itself; 'changed' gives the row read back,
// 'nothing' and 'name-taken' null, as the sample's; 'forbidden' throws Refused, which the action turns into the 404.
// The admin page and the name check read the cached rows; the actions expire `pickup-points` after each write.

/**
 * Every point as the store keeps it, each campus's together: by campus, then by when it was added, then by name (the
 * 24 reference points share one time, so the name gives the store's library-then-reception order: amendment 12), and
 * the id last, so pages never skip or repeat a row. Cached, tagged `pickup-points`, through the cookieless client.
 */
export async function pickupPointRows(): Promise<PickupPointRow[]> {
  "use cache";
  tagPickupPoints();
  const rows = await selectAll(
    () => forPublic().from("pickup_points").select("id, campus_slug, name, retired_at, created_at"),
    ["campus_slug", "created_at", "name", "id"],
  );
  return rows.map((row) => ({
    id: row.id,
    campusSlug: row.campus_slug,
    name: row.name,
    retiredAt: iso(row.retired_at),
    createdAt: iso(row.created_at),
  }));
}

/** The points in use: what onboarding, Edit shop and the listing form offer. */
export const pointsInUse: AsyncTwin<typeof Sample.pointsInUse> = async () =>
  (await pickupPointRows()).filter((row) => !row.retiredAt).map(toPoint);

/** Any point by id, retired or not, for a listing's page. Null for none. */
export const pickupPointById: AsyncTwin<typeof Sample.pickupPointById> = async (id) => {
  if (!id) return null;
  const row = (await pickupPointRows()).find((point) => point.id === id);
  return row ? toPoint(row) : null;
};

// --- The admin's reads and the Hub's writes (C4/C5 plan Task 17) ---------------------------------------------------

/** Every point, retired ones included, each campus's together, for the admin page. Copies. */
export const listPickupPoints: typeof Sample.listPickupPoints = async () => (await pickupPointRows()).map((row) => ({ ...row }));

/** Whether another point on the campus has this name, compared as add_pickup_point compares it (name_key). */
export const isPointNameTaken: typeof Sample.isPointNameTaken = async (campusSlug, name, exceptId) => {
  const key = nameKey(name);
  return (await pickupPointRows()).some((row) => row.id !== exceptId && row.campusSlug === campusSlug && nameKey(row.name) === key);
};

const POINT_COLUMNS = "id, campus_slug, name, retired_at, created_at";

function failed(what: string, error: { code?: string }): never {
  throw new Error(`${what} failed (${error.code ?? "unknown"})`);
}

/** A staff function's answer: true when it changed the point; 'forbidden' throws (C4/C5 plan decision 2). */
function changedBy(what: string, answer: { data: unknown; error: { code?: string } | null }): boolean {
  if (answer.error) failed(what, answer.error);
  if (answer.data === "changed") return true;
  if (answer.data === "nothing" || answer.data === "name-taken") return false;
  if (answer.data === "forbidden") throw new Refused("forbidden");
  throw new Error(`${what} answered ${String(answer.data)}`);
}

/** A point as the store keeps it, read now (never from the cache, which the write hasn't expired yet). */
async function pointRow(client: DbClient, column: "id" | "name", value: string, campusSlug?: string): Promise<PickupPointRow | null> {
  let query = client.from("pickup_points").select(POINT_COLUMNS).eq(column, value);
  if (campusSlug) query = query.eq("campus_slug", campusSlug);
  const { data, error } = await query.maybeSingle();
  if (error) failed("pickup_points", error);
  return data
    ? { id: data.id, campusSlug: data.campus_slug, name: data.name, retiredAt: iso(data.retired_at), createdAt: iso(data.created_at) }
    : null;
}

/** Adds a point; null when the campus has one by that name already, or has none (Eduvos Online). */
export const addPickupPoint: typeof Sample.addPickupPoint = async (campusSlug, name) => {
  const client = await forViewer();
  if (!changedBy("add_pickup_point", await client.rpc("add_pickup_point", { p_campus: campusSlug, p_name: name }))) return null;
  return pointRow(client, "name", name, campusSlug);
};

/** Renames a point, keeping its id; its old name, or null when nothing changed or the name is another point's. */
export const renamePickupPoint: typeof Sample.renamePickupPoint = async (id, name) => {
  const client = await forViewer();
  const before = await pointRow(client, "id", id);
  if (!before) return null;
  if (!changedBy("rename_pickup_point", await client.rpc("rename_pickup_point", { p_point: id, p_name: name }))) return null;
  return { before: before.name };
};

export const retirePickupPoint: typeof Sample.retirePickupPoint = async (id) => {
  const client = await forViewer();
  if (!changedBy("retire_pickup_point", await client.rpc("retire_pickup_point", { p_point: id }))) return null;
  return pointRow(client, "id", id);
};

export const restorePickupPoint: typeof Sample.restorePickupPoint = async (id) => {
  const client = await forViewer();
  if (!changedBy("restore_pickup_point", await client.rpc("restore_pickup_point", { p_point: id }))) return null;
  return pointRow(client, "id", id);
};
