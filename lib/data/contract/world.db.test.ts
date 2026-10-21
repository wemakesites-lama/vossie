import { describe, expect, it, vi } from "vitest";
import { viewerId } from "@/lib/data/supabase/clients";
import { seedUuid } from "@/scripts/seed-sql";
import { dropContractAccounts, normalise } from "@/tests/db/parity";
import { supabaseWorld } from "@/tests/db/supabase-world";
import { worldContract } from "./world.contract";

vi.mock("@/lib/data/supabase/clients", async (original) => (await import("@/tests/db/viewer")).withViewerSeam(await original()));

describe("the world's verbs on the local stack (C4/C5 plan Task 3)", () => {
  worldContract(supabaseWorld);
});

describe("the viewer seam (C4/C5 plan amendment 7)", () => {
  it("gives two calls running at once each their own viewer", async () => {
    const world = supabaseWorld();
    const seen: string[] = [];
    const pause = () => new Promise((resolve) => setTimeout(resolve, 20));
    await Promise.all([
      world.asViewer("asker", async () => {
        await pause();
        seen.push(`asker:${await viewerId()}`);
      }),
      world.asViewer("staff", async () => {
        seen.push(`staff:${await viewerId()}`);
        await pause();
        seen.push(`staff:${await viewerId()}`);
      }),
    ]);
    const asker = await world.signedIn("asker");
    const staff = await world.signedIn("staff");
    expect(seen.sort()).toEqual([`asker:${asker}`, `staff:${staff}`, `staff:${staff}`].sort());
    await expect(viewerId()).rejects.toThrow("No viewer");
  });
});

describe("parity's account ids (C4/C5 plan decision 15)", () => {
  it("maps the sample's account ids to the seed's uuids", () => {
    expect(normalise({ askerId: "acc-student" })).toEqual({ askerId: seedUuid("account", "acc-student") });
  });

  it("drops the contract accounts from a staff list, in either backend", async () => {
    const world = supabaseWorld();
    const seeded = seedUuid("account", "acc-admin");
    const list = [{ id: "acc-contract-staff" }, { id: await world.signedIn("staff") }, { id: seeded }, { id: "acc-admin" }];
    expect(dropContractAccounts(list, (item) => item.id)).toEqual([{ id: seeded }, { id: "acc-admin" }]);
  });
});
