import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeSupabase } from "@/tests/helpers/fake-supabase";
import { saveHubPost } from "./hub-posts";

// A Hub post's save on Supabase (C4/C5 plan Task 18; amendment 12): the files of a replaced cover go from Storage after
// save_hub_post has committed, and a removal that fails never undoes the save.

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ cacheTag: () => {}, cacheLife: () => {} }));
const seam = vi.hoisted(() => ({ viewer: null as unknown, removed: [] as string[][], failRemoval: false }));
vi.mock("./clients", () => ({ forViewer: async () => seam.viewer, forPublic: () => seam.viewer, forServer: () => seam.viewer }));
vi.mock("./viewer", () => ({ forViewerAs: async () => seam.viewer }));
vi.mock("./photos", () => ({
  dbPhotoId: (src: string) => src.replace(/^\/photos\//, ""),
  removePhotoFiles: async (paths: string[]) => {
    seam.removed.push(paths);
    if (seam.failRemoval) throw new Error("Storage is down");
    return paths.length;
  },
}));

const ROW = {
  id: "h-abc",
  kind: "tip",
  title: "Contract tip",
  summary: "A tip.",
  place: null,
  body: "A tip's body.",
  campus_slug: null,
  starts_at: null,
  capacity: null,
  going: null,
  image_src: null,
  image_alt: "",
  cover_photo_id: "00000000-0000-4000-8000-000000000002",
  published: true,
  published_at: "2026-10-21T08:00:00+00:00",
  author_id: "staff-1",
  created_at: "2026-10-20T08:00:00+00:00",
  updated_at: "2026-10-21T08:00:00+00:00",
};
const FIELDS = {
  kind: "tip" as const,
  title: "Contract tip",
  campusSlug: "all",
  startsAt: null,
  place: null,
  capacity: null,
  summary: "A tip.",
  body: "A tip's body.",
  published: true,
};
const save = () =>
  saveHubPost({
    id: "h-abc",
    fields: FIELDS,
    cover: { src: "/photos/00000000-0000-4000-8000-000000000002", alt: "" },
    authorId: "staff-1",
    now: new Date("2026-10-21T08:00:00.000Z"),
  });

let db: ReturnType<typeof fakeSupabase>;
beforeEach(() => {
  db = fakeSupabase();
  seam.viewer = db.client;
  seam.removed = [];
  seam.failRemoval = false;
});

describe("saving a Hub post's new cover on Supabase", () => {
  it("removes the replaced cover's files after the save, and gives the post read back", async () => {
    db.answer("from:staff_hub_posts", { data: { ...ROW, cover_photo_id: "00000000-0000-4000-8000-000000000001" } });
    db.answer("rpc:save_hub_post", { data: { result: "changed", id: "h-abc", removed_paths: ["hub/00000000-0000-4000-8000-000000000001"] } });
    db.answer("from:staff_hub_posts", { data: ROW });
    const saved = await save();
    expect(seam.removed).toEqual([["hub/00000000-0000-4000-8000-000000000001"]]);
    expect(saved).toMatchObject({ changed: true, created: false, row: { id: "h-abc", image: { src: `/photos/${ROW.cover_photo_id}`, alt: "" } } });
    expect(db.calls).toContainEqual(["rpc", "save_hub_post", expect.objectContaining({ p_cover_photo_id: ROW.cover_photo_id, p_campus: null })]);
  });

  it("keeps the save when the removal fails: the sweep takes the file later", async () => {
    seam.failRemoval = true;
    db.answer("from:staff_hub_posts", { data: { ...ROW, cover_photo_id: "00000000-0000-4000-8000-000000000001" } });
    db.answer("rpc:save_hub_post", { data: { result: "changed", id: "h-abc", removed_paths: ["hub/00000000-0000-4000-8000-000000000001"] } });
    db.answer("from:staff_hub_posts", { data: ROW });
    expect(await save()).toMatchObject({ changed: true, row: { id: "h-abc" } });
  });

  it("throws Refused for an answer the sample's shape can't carry", async () => {
    db.answer("from:staff_hub_posts", { data: ROW });
    db.answer("rpc:save_hub_post", { data: { result: "cover-invalid" } });
    await expect(save()).rejects.toMatchObject({ name: "Refused", code: "cover-invalid" });
  });
});
