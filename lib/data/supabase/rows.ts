import "server-only";
import { ALL_CAMPUSES } from "@/lib/campus";
import type { CampusChoice } from "@/lib/types";

// The mapping rules every Supabase twin shares (2b plan decision 22), so a twin's rows come out exactly as the sample
// store's do.

/**
 * A database time as the store writes it: PostgREST writes "+00:00" (and drops trailing zeros of the fraction), the
 * store "….000Z". Missing stays null; something that isn't a time throws rather than becoming "Invalid Date".
 */
export function iso(value: string): string;
export function iso(value: string | null | undefined): string | null;
export function iso(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const time = new Date(value);
  if (Number.isNaN(time.getTime())) throw new Error(`iso(): not a time: ${value}`);
  return time.toISOString();
}

/** The app's "all" campuses is null in the database (spec amendment 12.2); a campus is its slug. */
export function campusToDb(campus: CampusChoice): string | null {
  return campus === ALL_CAMPUSES ? null : campus;
}

/** A database campus back to the app's: null is "all". */
export function campusFromDb(slug: string | null): CampusChoice {
  return slug ?? ALL_CAMPUSES;
}

/**
 * A photo's address: a stored photo is served at /photos/<uuid>, a placeholder keeps its own path, and neither (a shop
 * showing its category's picture) is null. Alt text isn't touched here: an empty alt stays empty.
 */
export function photoSrc(photo: { photo_id: string | null; placeholder_src: string | null }): string | null {
  if (photo.photo_id) return `/photos/${photo.photo_id}`;
  return photo.placeholder_src ?? null;
}

/** PostgREST answers at most 1,000 rows a request (Supabase's default max_rows). */
export const SELECT_PAGE = 1_000;

/** What selectAll needs of PostgREST's query builder: order(), range(), and a page of rows when awaited. */
export interface PagedQuery<Row> extends PromiseLike<{ data: Row[] | null; error: { message: string } | null }> {
  order(column: string, options?: { ascending?: boolean }): this;
  range(from: number, to: number): this;
}

/**
 * Every row of a query, a page of SELECT_PAGE at a time, until a page comes back short. `query` makes a fresh builder
 * for each page. Each page is ordered by `order`, ascending, which must end in a unique key (the id, or every column
 * of a composite key), or pages could skip or repeat rows (amendment 13). The database's error throws, so a reader
 * never gets part of the rows.
 */
export async function selectAll<Row>(query: () => PagedQuery<Row>, order: readonly string[]): Promise<Row[]> {
  if (order.length === 0) throw new Error("selectAll() needs an order that ends in a unique key");
  const rows: Row[] = [];
  for (let from = 0; ; from += SELECT_PAGE) {
    let page = query();
    for (const column of order) page = page.order(column, { ascending: true });
    const { data, error } = await page.range(from, from + SELECT_PAGE - 1);
    if (error) throw new Error(error.message);
    const got = data ?? [];
    rows.push(...got);
    if (got.length < SELECT_PAGE) return rows;
  }
}

/**
 * A twin of a sample function that the sample store answers synchronously: the same arguments and the same answer, as
 * a promise, since the database is a round trip away. Twins of async sample functions are typed `typeof` the sample
 * function itself (2b plan decision 15).
 */
export type AsyncTwin<F extends (...args: never[]) => unknown> = (...args: Parameters<F>) => Promise<Awaited<ReturnType<F>>>;
