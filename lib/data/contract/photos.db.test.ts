import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as clients from "@/lib/data/supabase/clients";
import { photoFor, photoIdOf, storePhotos, type PhotoViewer, type Upload } from "@/lib/data/photos";
import { removePhotoFiles } from "@/lib/data/supabase/photos";
import { jpegBytes, pngBytes } from "@/tests/helpers/image-bytes";
import { supabaseWorld, type SupabaseWorld } from "@/tests/db/supabase-world";
import { photosContract } from "./photos.contract";

// Stored photos on the local stack (C2/C3 plan Task 5): the contract, and what only Supabase has: the files in Storage,
// an upload that fails, the Hub's covers kept for Hub staff (the controller's answer to open question 4), and the
// viewer checked against the account a twin is given (decision 2).
vi.mock("@/lib/data/supabase/clients", async (original) => (await import("@/tests/db/viewer")).withViewerSeam(await original()));

describe("stored photos on the local stack (C2/C3 plan Task 5)", () => {
  photosContract(supabaseWorld);
});

const jpeg = (): Upload => ({ type: "image/jpeg", bytes: jpegBytes() });
const png = (): Upload => ({ type: "image/png", bytes: pngBytes() });
const nobody = async (): Promise<PhotoViewer | null> => null;
const idOf = (src: string) => photoIdOf(src)!;

describe("photos in Storage (C2/C3 plan decisions 11 to 14)", () => {
  let world: SupabaseWorld;
  let seller: string;
  beforeEach(async () => {
    world = supabaseWorld();
    seller = await world.signedIn("seller");
    await world.tidySelling("seller");
    await world.tidySelling("hub");
  });
  afterEach(async () => {
    vi.restoreAllMocks();
    await world.cleanup();
  });

  it("keeps the file at {owner}/{id} with the photo's type, and the Hub's at hub/{id}", async () => {
    const [src] = await world.asViewer("seller", () => storePhotos(seller, [jpeg()], new Date()));
    const path = `${seller}/${idOf(src)}`;
    expect(await world.fileExists(path)).toBe(true);
    const file = await world.admin.storage.from("photos").download(path);
    expect(file.data?.type).toBe("image/jpeg");
    const [cover] = await world.asViewer("staff", () => storePhotos("hub", [png()], new Date()));
    expect(await world.fileExists(`hub/${idOf(cover)}`)).toBe(true);
  });

  it("removes the oldest waiting photo's file when the 13th is stored", async () => {
    const srcs: string[] = [];
    for (let i = 0; i < 13; i += 1) srcs.push(...(await world.asViewer("seller", () => storePhotos(seller, [png()], new Date()))));
    expect(await world.fileExists(`${seller}/${idOf(srcs[0])}`)).toBe(false);
    expect(await world.fileExists(`${seller}/${idOf(srcs[1])}`)).toBe(true);
  });

  it("leaves no row and no file when an upload fails, and rejects", async () => {
    const real = clients.forServer;
    let uploads = 0;
    vi.spyOn(clients, "forServer").mockImplementation(() => {
      const admin = real();
      const from = admin.storage.from.bind(admin.storage);
      admin.storage.from = (bucket: string) => {
        const files = from(bucket);
        const upload = files.upload.bind(files);
        files.upload = (async (...args: Parameters<typeof upload>) => {
          uploads += 1;
          // The second file fails, after the first is in.
          if (uploads === 2) {
            await new Promise((resolve) => setTimeout(resolve, 200));
            return { data: null, error: Object.assign(new Error("down"), { status: 503 }) };
          }
          return upload(...args);
        }) as typeof upload;
        return files;
      };
      return admin;
    });
    await expect(world.asViewer("seller", () => storePhotos(seller, [jpeg(), png()], new Date()))).rejects.toThrow(
      "photo upload failed",
    );
    const rows = await world.admin.from("photos").select("id").eq("owner_id", seller);
    expect(rows.data).toEqual([]);
    const files = await world.admin.storage.from("photos").list(seller);
    expect(files.data).toEqual([]);
  });

  it("answers a sample id with null, asking the database nothing (decision 13)", async () => {
    const spy = vi.spyOn(clients, "forServer");
    expect(await photoFor("ph-00000000-0000-4000-8000-000000000000", nobody, new Date())).toBeNull();
    expect(await photoFor("00000000-0000-4000-8000-000000000000", nobody, new Date())).toBeNull();
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("won't store photos for an account that isn't the viewer (decision 2)", async () => {
    const shopper = await world.signedIn("shopper");
    await expect(world.asViewer("seller", () => storePhotos(shopper, [jpeg()], new Date()))).rejects.toThrow(
      "isn't the signed-in one",
    );
  });

  it("keeps the Hub's waiting covers and unpublished posts' covers for Hub staff (open question 4)", async () => {
    const staff = await world.signedIn("staff");
    const hubStaff = async (): Promise<PhotoViewer> => ({ id: staff, hubStaff: true });
    const student = async (): Promise<PhotoViewer> => ({ id: seller, hubStaff: false });
    const [waiting, draftCover, liveCover] = await world.asViewer("staff", () =>
      storePhotos("hub", [png(), png(), png()], new Date()),
    );
    for (const viewer of [nobody, student]) expect(await photoFor(idOf(waiting), viewer, new Date())).toBeNull();
    expect(await photoFor(idOf(waiting), hubStaff, new Date())).not.toBeNull();

    await world.addHubPost({ published: false, coverSrc: draftCover });
    for (const viewer of [nobody, student]) expect(await photoFor(idOf(draftCover), viewer, new Date())).toBeNull();
    expect(await photoFor(idOf(draftCover), hubStaff, new Date())).not.toBeNull();

    await world.addHubPost({ published: true, coverSrc: liveCover });
    const asked = vi.fn(nobody);
    expect(await photoFor(idOf(liveCover), asked, new Date())).not.toBeNull();
    expect(asked).not.toHaveBeenCalled();
  });

  it("removes no files for no paths, and logs a Storage failure with its status and count only", async () => {
    const spy = vi.spyOn(clients, "forServer");
    expect(await removePhotoFiles([])).toBe(0);
    expect(spy).not.toHaveBeenCalled();

    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    spy.mockImplementation(
      () =>
        ({
          storage: { from: () => ({ remove: async () => ({ data: null, error: Object.assign(new Error("x"), { status: 500 }) }) }) },
        }) as unknown as ReturnType<typeof clients.forServer>,
    );
    const path = `${seller}/00000000-0000-4000-8000-000000000000`;
    expect(await removePhotoFiles([path])).toBe(0);
    expect(log).toHaveBeenCalledWith("[vossie] photo files not removed (500, 1)");
    expect(JSON.stringify(log.mock.calls)).not.toContain(seller);
  });
});
