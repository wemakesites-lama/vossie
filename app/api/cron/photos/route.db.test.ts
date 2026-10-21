import { randomBytes, randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { photoIdOf, storePhotos, type Upload } from "@/lib/data/photos";
import { pngBytes } from "@/tests/helpers/image-bytes";
import { supabaseWorld, type SupabaseWorld } from "@/tests/db/supabase-world";
import { GET } from "./route";

// The photo sweep on the local stack (C2/C3 plan Task 7, decision 15): behind CRON_SECRET (a throwaway value made in
// the test), it removes waiting photos a day old, the Hub's too, rows and files, and files no photo names that are more
// than an hour old.
vi.mock("@/lib/data/supabase/clients", async (original) => (await import("@/tests/db/viewer")).withViewerSeam(await original()));
vi.mock("next/server", async () => (await import("@/tests/helpers/next-request")).nextServer());

const png = (): Upload => ({ type: "image/png", bytes: pngBytes() });
const call = (authorization?: string) =>
  GET(new Request("http://localhost/api/cron/photos", { headers: authorization === undefined ? {} : { Authorization: authorization } }));

describe("/api/cron/photos on the local stack (C2/C3 plan Task 7)", () => {
  let world: SupabaseWorld;
  let seller: string;
  let secret: string;
  beforeEach(async () => {
    world = supabaseWorld();
    seller = await world.signedIn("seller");
    secret = randomBytes(32).toString("hex");
    vi.stubEnv("CRON_SECRET", secret);
    await world.tidySelling("seller");
    await world.tidySelling("hub");
  });
  afterEach(async () => {
    vi.unstubAllEnvs();
    await world.cleanup();
  });

  /** The rows still there, of these photos. */
  async function rowsLeft(srcs: readonly string[]): Promise<string[]> {
    const { data, error } = await world.admin.from("photos").select("id").in("id", srcs.map((src) => photoIdOf(src)!));
    if (error) throw new Error(error.message);
    return data.map((row) => `/photos/${row.id}`).sort();
  }

  it("refuses a call without the secret, with the wrong one, and every call while it's unset; nothing changes", async () => {
    const [stale] = await world.asViewer("seller", () => storePhotos(seller, [png()], new Date()));
    await world.ageWaitingPhoto(stale, 25);
    for (const header of [undefined, `Bearer ${secret}x`, `Bearer ${"0".repeat(64)}`, secret]) {
      const response = await call(header);
      expect(response.status, String(header)).toBe(401);
      expect(response.headers.get("Cache-Control")).toBe("no-store");
    }
    vi.stubEnv("CRON_SECRET", "");
    expect((await call("Bearer ")).status).toBe(401);
    expect(await rowsLeft([stale])).toEqual([stale]);
    expect(await world.fileExists(`${seller}/${photoIdOf(stale)}`)).toBe(true);
  });

  it("sweeps waiting photos a day old and old orphan files, then nothing", async () => {
    // Anything another run left behind goes first, so the counts below are this test's.
    expect((await call(`Bearer ${secret}`)).status).toBe(200);

    const [stale, fresh] = await world.asViewer("seller", () => storePhotos(seller, [png(), png()], new Date()));
    const [cover] = await world.asViewer("staff", () => storePhotos("hub", [png()], new Date()));
    await world.ageWaitingPhoto(stale, 25);
    await world.ageWaitingPhoto(cover, 25);
    const oldOrphan = `${seller}/${randomUUID()}`;
    const newOrphan = `${seller}/${randomUUID()}`;
    await world.orphanFile(oldOrphan, 2);
    await world.orphanFile(newOrphan, 0);

    const response = await call(`Bearer ${secret}`);
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toEqual({ rows: 2, files: 3 });
    expect(await rowsLeft([stale, fresh, cover])).toEqual([fresh]);
    expect(await world.fileExists(`${seller}/${photoIdOf(stale)}`)).toBe(false);
    expect(await world.fileExists(`hub/${photoIdOf(cover)}`)).toBe(false);
    expect(await world.fileExists(`${seller}/${photoIdOf(fresh)}`)).toBe(true);
    expect(await world.fileExists(oldOrphan)).toBe(false);
    expect(await world.fileExists(newOrphan)).toBe(true);

    expect(await (await call(`Bearer ${secret}`)).json()).toEqual({ rows: 0, files: 0 });
  });
});
