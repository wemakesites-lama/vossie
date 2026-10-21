import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, expectTypeOf, it, vi } from "vitest";
import type { Database } from "@/lib/supabase/database.types";
import { campusFromDb, campusToDb, iso, photoSrc, selectAll, SELECT_PAGE } from "./rows";

// The mapping rules every Supabase twin shares (2b plan decision 22, amendment 13). Plain functions: nothing here
// reaches a network.
vi.mock("server-only", () => ({}));

describe("times (2b plan decision 22)", () => {
  it("writes PostgREST's +00:00 the way the store does, with milliseconds and Z", () => {
    expect(iso("2026-10-01T08:00:00+00:00")).toBe("2026-10-01T08:00:00.000Z");
    expect(iso("2026-10-01T10:00:00.5+02:00")).toBe("2026-10-01T08:00:00.500Z");
    expect(iso("2026-10-01T08:00:00.000Z")).toBe("2026-10-01T08:00:00.000Z");
  });

  it("keeps a missing time missing", () => {
    expect(iso(null)).toBeNull();
    expect(iso(undefined)).toBeNull();
  });

  it("refuses something that isn't a time, rather than writing \"Invalid Date\"", () => {
    expect(() => iso("not a time")).toThrow("not a time");
  });
});

describe("campuses (spec amendment 12.2)", () => {
  it("stores the app's \"all\" as null, and a campus as its slug", () => {
    expect(campusToDb("all")).toBeNull();
    expect(campusToDb("pretoria")).toBe("pretoria");
  });

  it("reads null back as \"all\"", () => {
    expect(campusFromDb(null)).toBe("all");
    expect(campusFromDb("pretoria")).toBe("pretoria");
  });
});

describe("photos' addresses (2b plan decision 22)", () => {
  const id = "0b7c8f8e-3f4a-4c55-9a8e-2d1b6c7e9f01";

  it("serves a stored photo at /photos/<uuid>", () => {
    expect(photoSrc({ photo_id: id, placeholder_src: null })).toBe(`/photos/${id}`);
  });

  it("keeps a placeholder's own path", () => {
    expect(photoSrc({ photo_id: null, placeholder_src: "/placeholders/books.svg" })).toBe("/placeholders/books.svg");
  });

  it("gives null when there's neither (a shop with its category's picture)", () => {
    expect(photoSrc({ photo_id: null, placeholder_src: null })).toBeNull();
  });
});

/** A stand-in for PostgREST's query builder: records order() and range() calls, and answers from `rows`. */
function stubQuery(rows: number[], calls: string[], error: { message: string } | null = null) {
  let from = 0;
  let to = 0;
  const builder = {
    order(column: string, options?: { ascending?: boolean }) {
      calls.push(`order ${column} ${options?.ascending === false ? "desc" : "asc"}`);
      return builder;
    },
    range(start: number, end: number) {
      calls.push(`range ${start}-${end}`);
      from = start;
      to = end;
      return builder;
    },
    then<A, B = never>(
      onfulfilled?: ((value: { data: number[] | null; error: { message: string } | null }) => A | PromiseLike<A>) | null,
      onrejected?: ((reason: unknown) => B | PromiseLike<B>) | null,
    ): PromiseLike<A | B> {
      const value = error ? { data: null, error } : { data: rows.slice(from, to + 1), error: null };
      return Promise.resolve(value).then(onfulfilled, onrejected);
    },
  };
  return builder;
}

describe("selectAll: every row, a page of 1,000 at a time (2b plan decision 17, amendment 13)", () => {
  it("pages with range() until a page comes back short", async () => {
    const rows = Array.from({ length: 2_345 }, (_, index) => index);
    const calls: string[] = [];
    const query = vi.fn(() => stubQuery(rows, calls));
    expect(SELECT_PAGE).toBe(1_000);
    expect(await selectAll(query, ["id"])).toEqual(rows);
    expect(query).toHaveBeenCalledTimes(3);
    expect(calls.filter((call) => call.startsWith("range"))).toEqual(["range 0-999", "range 1000-1999", "range 2000-2999"]);
  });

  it("asks once more after an exactly full page, and stops on the empty one", async () => {
    const rows = Array.from({ length: 1_000 }, (_, index) => index);
    const calls: string[] = [];
    expect(await selectAll(() => stubQuery(rows, calls), ["id"])).toHaveLength(1_000);
    expect(calls.filter((call) => call.startsWith("range"))).toEqual(["range 0-999", "range 1000-1999"]);
  });

  it("orders every page by the columns given, in order, before its range, so pages never skip or repeat a row", async () => {
    const calls: string[] = [];
    await selectAll(() => stubQuery([1, 2, 3], calls), ["campus_slug", "created_at", "id"]);
    expect(calls).toEqual(["order campus_slug asc", "order created_at asc", "order id asc", "range 0-999"]);
  });

  it("refuses to page without an order", async () => {
    await expect(selectAll(() => stubQuery([1], []), [])).rejects.toThrow("order");
  });

  it("throws the database's error rather than returning part of the rows", async () => {
    await expect(selectAll(() => stubQuery([1], [], { message: "permission denied for table profiles" }), ["id"])).rejects.toThrow(
      "permission denied for table profiles",
    );
  });

  it("returns an empty list for an empty table", async () => {
    expect(await selectAll(() => stubQuery([], []), ["id"])).toEqual([]);
  });

  it("takes PostgREST's own query builder and keeps its row type (checked by pnpm typecheck)", () => {
    const read = (client: SupabaseClient<Database>) =>
      selectAll(() => client.from("pickup_points").select("id, campus_slug"), ["campus_slug", "id"]);
    expectTypeOf(read).returns.resolves.toEqualTypeOf<{ id: string; campus_slug: string }[]>();
  });
});
