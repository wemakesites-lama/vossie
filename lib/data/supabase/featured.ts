import "server-only";
import { drawFeatured } from "@/lib/featured";
import { addDays } from "@/lib/staff/rules";
import type { CampusChoice } from "@/lib/types";
import { catalogOver } from "../catalog";
import type * as Sample from "../featured";
import { eligibleIn, FEATURED_PLACES, KEEP_DAYS, REST_DAYS, restingBefore } from "../featured";
import { catalogSnapshot, catalogSourceFrom } from "./catalog";
import { type DbClient, forServer } from "./clients";
import { campusToDb } from "./rows";

// Featured on Supabase (2b plan Task 18; decisions 9 and 21, amendment 1's answer 4). The rules stay in TypeScript:
// who may be featured is the catalog's (the cached public snapshot, as the storefronts see it), and the day's row is
// drawn by drawFeatured on its first view, as in the sample store. Pins and draws are admins' and the server's, so
// they're read and written with the admin client: request-time code only (the homepage's section renders after
// connection(), the admin's Featured page per request), never inside "use cache". Only the sellers leave the server.
//
// Shops are kept by id in the database and by slug in the app; the snapshot maps one to the other. A pinned, drawn or
// resting shop the snapshot doesn't have has no storefront now, so it can't be featured, as in the sample store.
// drawFeatured sorts the sellers it's given by slug, so the order the snapshot lists them in doesn't matter.
//
// The pins, featuredChoices and listPins stay in the sample module until C5. Old pins are kept as rows (the draw reads
// only its own day's); draws older than KEEP_DAYS are deleted as new ones are drawn, as the sample store tidies them.

/** One campus's rows: "all" is a null campus in the database (spec amendment 12.2). */
function onCampus<Q extends { eq(column: string, value: string): Q; is(column: string, value: null): Q }>(
  query: Q,
  campus: CampusChoice,
): Q {
  const slug = campusToDb(campus);
  return slug === null ? query.is("campus_slug", null) : query.eq("campus_slug", slug);
}

/** The campus's recorded row for the day, as shop ids in order, or null when it hasn't been drawn yet. */
async function recordedRow(db: DbClient, campus: CampusChoice, day: string): Promise<string[] | null> {
  const { data, error } = await onCampus(db.from("featured_draws").select("shop_ids").eq("day", day), campus).maybeSingle();
  if (error) throw new Error(error.message);
  return data?.shop_ids ?? null;
}

/**
 * A campus's Featured row for a SAST day (spec 2.8): the recorded row when there is one, else a new draw, recorded. A
 * seller who has stopped being eligible since drops out, and the place stays empty until tomorrow (plan decision 9).
 */
export const featuredFor: typeof Sample.featuredFor = async (campus, day) => {
  const db = forServer();
  const snapshot = await catalogSnapshot();
  const slugOf = new Map(snapshot.shops.map((shop) => [shop.id, shop.slug]));
  const idOf = new Map(snapshot.shops.map((shop) => [shop.slug, shop.id]));
  const slugs = (ids: readonly string[]) => ids.flatMap((id) => slugOf.get(id) ?? []);
  const eligible = eligibleIn(catalogOver(catalogSourceFrom(snapshot)));

  let row = await recordedRow(db, campus, day);
  if (row === null) {
    // The campus's rows of the last REST_DAYS days, for the week's break, and the day's pins in the order made.
    const recent = await onCampus(
      db.from("featured_draws").select("day, shop_ids").gte("day", addDays(day, -REST_DAYS)).lt("day", day),
      campus,
    );
    if (recent.error) throw new Error(recent.error.message);
    const rows = new Map(recent.data.map((draw) => [draw.day, slugs(draw.shop_ids)]));
    const resting = restingBefore(day, (shown) => rows.get(shown));
    const pins = await onCampus(
      db.from("featured_pins").select("shop_id").eq("day", day).order("created_at").order("id"),
      campus,
    );
    if (pins.error) throw new Error(pins.error.message);
    const pinned = slugs(pins.data.map((pin) => pin.shop_id));

    const drawn = drawFeatured(eligible, campus, day, FEATURED_PLACES, { pinned, resting });
    // Two first views at once both draw; the first row stored wins and both show it.
    const stored = await db
      .from("featured_draws")
      .upsert(
        { campus_slug: campusToDb(campus), day, shop_ids: drawn.flatMap((seller) => idOf.get(seller.slug) ?? []) },
        { onConflict: "campus_slug,day", ignoreDuplicates: true },
      );
    if (stored.error) throw new Error(stored.error.message);
    row = await recordedRow(db, campus, day);
    if (row === null) throw new Error(`featuredFor(): no row for ${campus} on ${day} after drawing it`);
    const tidied = await db.from("featured_draws").delete().lt("day", addDays(day, -KEEP_DAYS));
    if (tidied.error) throw new Error(tidied.error.message);
  }
  const bySlug = new Map(eligible.map((seller) => [seller.slug, seller]));
  return slugs(row).flatMap((slug) => bySlug.get(slug) ?? []);
};
