import "server-only";
import type { PickupPointRow } from "../rows";
import type * as Sample from "../pickup-points";
import { toPoint } from "../pickup-points";
import { tagPickupPoints } from "../tags";
import { forPublic } from "./clients";
import { type AsyncTwin, iso, selectAll } from "./rows";

// Pickup points on Supabase (2b plan Task 14, decision 14): the sample module's public reads, over the pickup_points
// table, which anyone may read, retired points included. Staff's writes stay in the sample module until C5.

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
