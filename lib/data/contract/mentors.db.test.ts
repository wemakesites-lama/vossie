import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { listNotes, mentoredShops } from "@/lib/data/mentors";
import { seedUuid } from "@/scripts/seed-sql";
import { normalise, parity } from "@/tests/db/parity";
import { supabaseWorld } from "@/tests/db/supabase-world";
import { setViewer } from "@/tests/db/viewer";
import { mentorsContract } from "./mentors.contract";

// The mentor dashboard's data on the local stack (C4/C5 plan Task 19): staff_seller_profiles, shops and mentor_notes
// through the viewer's session, add_mentor_note and add_check_in with the author's.
vi.mock("@/lib/data/supabase/clients", async (original) => (await import("@/tests/db/viewer")).withViewerSeam(await original()));

describe("the mentor dashboard's data on the local stack (C4/C5 plan Task 19)", () => {
  mentorsContract(supabaseWorld);
});

describe("the mentor dashboard gives the sample store's answer on the seed, for an admin (C4/C5 plan Task 19)", () => {
  beforeEach(() => {
    setViewer("staff");
  });
  afterEach(() => {
    setViewer(null);
  });

  it("lists every assigned seed shop with its numbers and flags", async () => {
    const now = new Date();
    const staff = await supabaseWorld().viewerAccount("staff");
    const { sample, supabase } = await parity(async () => {
      // The sample world's admin and the stack's have different ids; neither owns a shop.
      return mentoredShops({ id: staff.id, roles: ["admin"] }, now);
    });
    expect(sample.length).toBeGreaterThan(0);
    expect(normalise(supabase)).toEqual(normalise(sample));
  });

  it("lists the seed's notes about Sipho newest first", async () => {
    const { sample, supabase } = await parity(() =>
      listNotes(process.env.VOSSIE_BACKEND === "supabase" ? seedUuid("account", "acc-seller") : "acc-seller"),
    );
    expect(sample).toHaveLength(2);
    expect(normalise(supabase)).toEqual(normalise(sample));
  });
});
