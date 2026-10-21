import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { forPublic, forServer, forViewer } from "@/lib/data/supabase/clients";
import { getCampuses } from "@/lib/data";
import { normalise, parity } from "@/tests/db/parity";
import { supabaseWorld, type SupabaseWorld } from "@/tests/db/supabase-world";
import { smokeContract } from "./smoke.contract";

// The contract harness on the local stack (2b plan Task 13), and the client seam it stands on.
vi.mock("@/lib/data/supabase/clients", async (original) => (await import("@/tests/db/viewer")).withViewerSeam(await original()));

describe("the contract harness on the local stack (2b plan Task 13)", () => {
  smokeContract(supabaseWorld);
});

describe("the twins' clients on the local stack (2b plan decisions 19 to 21)", () => {
  let world: SupabaseWorld;
  beforeEach(() => {
    world = supabaseWorld();
  });
  afterEach(async () => {
    await world.cleanup();
  });

  /** A request by that account, written with the admin client and deleted after the test. */
  async function requestBy(name: "asker" | "shopper"): Promise<string> {
    const { data, error } = await world.admin
      .from("requests")
      .insert({
        asker_id: await world.signedIn(name),
        title: `Contract smoke ${name}`,
        details: "A request the contract harness writes and deletes again.",
        category_slug: "tech",
        campus_slug: "pretoria",
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    world.undoLater(async () => {
      const deleted = await world.admin.from("requests").delete().eq("id", data.id);
      if (deleted.error) throw new Error(deleted.error.message);
    });
    return data.id;
  }

  async function myRequestIds(): Promise<string[]> {
    const { data, error } = await (await forViewer()).from("my_requests").select("id");
    if (error) throw new Error(error.message);
    return data.flatMap(({ id }) => (id ? [id] : []));
  }

  it("forViewer() reads my_requests as the viewer, and none of another account's", async () => {
    const asker = await requestBy("asker");
    const shopper = await requestBy("shopper");
    expect(await world.asViewer("asker", myRequestIds)).toEqual([asker]);
    expect(await world.asViewer("shopper", myRequestIds)).toEqual([shopper]);
  });

  it("forViewer() has no viewer outside asViewer", async () => {
    await expect(forViewer()).rejects.toThrow("No viewer");
  });

  it("forPublic() can't read profiles", async () => {
    const { data, error } = await forPublic().from("profiles").select("id");
    expect(data).toBeNull();
    expect(error?.code).toBe("42501");
  });

  it("forServer() can", async () => {
    const ids = [await world.signedIn("asker"), await world.signedIn("shopper"), await world.signedIn("staff")];
    const { data, error } = await forServer().from("profiles").select("id, campus_slug, roles").in("id", ids).order("id");
    expect(error).toBeNull();
    expect(data).toHaveLength(3);
    expect(data?.every((row) => row.campus_slug === "pretoria")).toBe(true);
    expect(data?.find((row) => row.id === ids[2])?.roles).toEqual(["admin"]);
  });

  it("runs a reader in both backends, and the cleanup undoes the newest write first", async () => {
    const { sample, supabase } = await parity(() => getCampuses());
    expect(normalise(supabase)).toEqual(normalise(sample));
    expect(process.env.VOSSIE_BACKEND).toBe("supabase");
    const order: string[] = [];
    world.undoLater(async () => void order.push("first"));
    world.undoLater(async () => void order.push("second"));
    await world.cleanup();
    expect(order).toEqual(["second", "first"]);
  });

  it("normalises the sample's pickup point ids and the fixtures' times, and leaves dates alone", () => {
    expect(
      normalise({ pickupPointIds: ["pp-pretoria-library"], createdAt: "2026-10-01T08:00:00Z", neededBy: "2026-10-20", title: "x" }),
    ).toEqual({
      pickupPointIds: [expect.stringMatching(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)],
      createdAt: "2026-10-01T08:00:00.000Z",
      neededBy: "2026-10-20",
      title: "x",
    });
  });
});
