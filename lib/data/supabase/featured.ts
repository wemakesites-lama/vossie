import "server-only";
import { drawFeatured } from "@/lib/featured";
import { addDays } from "@/lib/staff/rules";
import type { CampusChoice } from "@/lib/types";
import { catalogOver } from "../catalog";
import type * as Sample from "../featured";
import { eligibleIn, FEATURED_PLACES, KEEP_DAYS, REST_DAYS, restingBefore } from "../featured";
import { Refused } from "../refused";
import type { FeaturedPinRow } from "../rows";
import { catalogSnapshot, catalogSourceFrom } from "./catalog";
import { type DbClient, forServer, forViewer } from "./clients";
import { campusFromDb, campusToDb, iso } from "./rows";
import { ownShopId } from "./staff-shops";
import { forViewerAs } from "./viewer";

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
// The admin's pins (C4/C5 plan Task 17) are read and written with the admin's own session instead: featured_pins'
// policy lets admins read them, and pin_shop and unpin_shop decide (the day, eligibility, taken, full, the admin's own
// shop) and forget that campus's row for the day, so it's drawn again, as the sample store throws its row away. Old
// pins are kept as rows (the draw reads only its own day's); draws older than KEEP_DAYS are deleted as new ones are
// drawn, as the sample store tidies them.

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

// --- The admin's pins (C4/C5 plan Task 17) --------------------------------------------------------------------------

function failed(what: string, error: { code?: string }): never {
  throw new Error(`${what} failed (${error.code ?? "unknown"})`);
}

const PIN_COLUMNS = "id, shop_id, campus_slug, day, pinned_by, created_at";

type PinRecord = {
  id: string;
  shop_id: string;
  campus_slug: string | null;
  day: string;
  pinned_by: string | null;
  created_at: string;
};

/** Shops' links and names by id, as the admin reads them (every shop). */
async function shopsById(db: DbClient, ids: readonly string[]): Promise<Map<string, { slug: string; name: string }>> {
  const shops = new Map<string, { slug: string; name: string }>();
  const unique = [...new Set(ids)];
  for (let from = 0; from < unique.length; from += 100) {
    const { data, error } = await db.from("shops").select("id, slug, name").in("id", unique.slice(from, from + 100));
    if (error) failed("shops", error);
    for (const row of data) shops.set(row.id, { slug: row.slug, name: row.name });
  }
  return shops;
}

function pinFrom(row: PinRecord, slug: string): FeaturedPinRow {
  return {
    id: row.id,
    sellerSlug: slug,
    campusSlug: campusFromDb(row.campus_slug),
    day: row.day,
    pinnedBy: row.pinned_by,
    createdAt: iso(row.created_at),
  };
}

/** The viewing admin's own shop's link, or null (none, or no viewer given). */
async function ownSlug(viewerId: string | null): Promise<string | null> {
  if (viewerId === null) return null;
  const db = await forViewerAs(viewerId);
  const shopId = await ownShopId(db, viewerId);
  if (!shopId) return null;
  return (await shopsById(db, [shopId])).get(shopId)?.slug ?? null;
}

/** The sellers an admin may pin, by name, leaving out the viewer's own shop: the catalog's rules over the snapshot. */
export const featuredChoices: typeof Sample.featuredChoices = async (viewerId = null) => {
  const own = await ownSlug(viewerId);
  return eligibleIn(catalogOver(catalogSourceFrom(await catalogSnapshot())))
    .filter((seller) => seller.slug !== own)
    .sort((a, b) => a.name.localeCompare(b.name));
};

/** One pin, or null when there's none. */
export const getPin: typeof Sample.getPin = async (id) => {
  const db = await forViewer();
  const { data, error } = await db.from("featured_pins").select(PIN_COLUMNS).eq("id", id).maybeSingle();
  if (error) failed("featured_pins", error);
  if (!data) return null;
  const shop = (await shopsById(db, [data.shop_id])).get(data.shop_id);
  return shop ? pinFrom(data, shop.slug) : null;
};

/** Pins from `fromDay` on: soonest first, then by campus, then in the order made. `viewerId` marks their own. */
export const listPins: typeof Sample.listPins = async (fromDay, viewerId = null) => {
  const db = await forViewer();
  const { data, error } = await db
    .from("featured_pins")
    .select(PIN_COLUMNS)
    .gte("day", fromDay)
    .order("created_at")
    .order("id");
  if (error) failed("featured_pins", error);
  const [shops, own] = await Promise.all([shopsById(db, data.map((row) => row.shop_id)), ownSlug(viewerId)]);
  const pinners = [...new Set(data.flatMap((row) => (row.pinned_by ? [row.pinned_by] : [])))];
  const names = new Map<string, string>();
  for (let from = 0; from < pinners.length; from += 100) {
    const people = await db.from("profiles").select("id, first_name").in("id", pinners.slice(from, from + 100));
    if (people.error) failed("profiles", people.error);
    for (const row of people.data) names.set(row.id, row.first_name);
  }
  return data
    .flatMap((row) => {
      const shop = shops.get(row.shop_id);
      if (!shop) return [];
      const pin = pinFrom(row, shop.slug);
      return [
        {
          ...pin,
          sellerName: shop.name,
          pinnedByName: (pin.pinnedBy ? names.get(pin.pinnedBy) : undefined) ?? "Deleted account",
          own: own !== null && own === shop.slug,
        },
      ];
    })
    .sort((a, b) => a.day.localeCompare(b.day) || a.campusSlug.localeCompare(b.campusSlug));
};

/**
 * A pin (spec 2.8), or why not, through pin_shop with the admin's session. A day already gone or more than 60 days off,
 * the admin's own shop, or no admin role throw Refused (decision 2): the action's own checks come first, so only a race
 * or a forged post meets them.
 */
export const addPin: typeof Sample.addPin = async ({ sellerSlug, campusSlug, day, staffId }) => {
  const db = await forViewerAs(staffId);
  const shop = await db.from("shops").select("id").eq("slug", sellerSlug).maybeSingle();
  if (shop.error) failed("shops", shop.error);
  if (!shop.data) return "not-eligible";
  const campus = campusToDb(campusSlug as CampusChoice);
  const { data, error } = await db.rpc("pin_shop", { p_shop: shop.data.id, p_campus: campus as string, p_day: day });
  if (error) failed("pin_shop", error);
  if (data === "not-eligible" || data === "taken" || data === "full") return data;
  if (data === "day-past" || data === "day-far" || data === "own-shop" || data === "forbidden") throw new Refused(data);
  if (data !== "changed") throw new Error(`pin_shop answered ${data}`);
  const query = db.from("featured_pins").select(PIN_COLUMNS).eq("shop_id", shop.data.id).eq("day", day);
  const pin = await (campus === null ? query.is("campus_slug", null) : query.eq("campus_slug", campus)).single();
  if (pin.error) failed("featured_pins", pin.error);
  return pinFrom(pin.data, sellerSlug);
};

/** Removes a pin through unpin_shop, which forgets that campus's row for its day. The pin, or null when there's none. */
export const removePin: typeof Sample.removePin = async (id) => {
  const pin = await getPin(id);
  if (!pin) return null;
  const { data, error } = await (await forViewer()).rpc("unpin_shop", { p_pin: id });
  if (error) failed("unpin_shop", error);
  if (data === "nothing") return null;
  if (data === "own-shop" || data === "forbidden") throw new Refused(data);
  if (data !== "changed") throw new Error(`unpin_shop answered ${data}`);
  return pin;
};
