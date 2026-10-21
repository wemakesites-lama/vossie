import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sampleHubPostRows } from "@/data/fixtures/staff";
import { getPostRow, listBookings, listPostsForStaff, openBookingCount } from "@/lib/data/hub-posts";
import { normalise, parity } from "@/tests/db/parity";
import { supabaseWorld } from "@/tests/db/supabase-world";
import { setViewer } from "@/tests/db/viewer";
import { hubStaffContract } from "./hub-staff.contract";

// The Hub's staff side on the local stack (C4/C5 plan Task 18): staff_hub_posts, save_hub_post, the RSVP and slot
// functions, and answer_booking, each with the signed-in session.
vi.mock("@/lib/data/supabase/clients", async (original) => (await import("@/tests/db/viewer")).withViewerSeam(await original()));
vi.mock("@/lib/data/supabase/auth-session", async (original) =>
  (await import("@/tests/db/viewer")).withSessionSeam(await original<object>()),
);

describe("the Hub's staff side on the local stack (C4/C5 plan Task 18)", () => {
  hubStaffContract(supabaseWorld);
});

describe("the Hub's staff pages give the sample store's answer on the seed (C4/C5 plan Task 18)", () => {
  beforeEach(() => {
    setViewer("staff");
  });
  afterEach(() => {
    setViewer(null);
  });

  it("lists every post in the same order, by the same authors", async () => {
    const { sample, supabase } = await parity(() => listPostsForStaff());
    expect(sample).toHaveLength(sampleHubPostRows.length);
    expect(normalise(supabase)).toEqual(normalise(sample));
  });

  it("gives each seed post's row as the editor reads it", async () => {
    for (const row of sampleHubPostRows) {
      const { sample, supabase } = await parity(() => getPostRow(row.id));
      expect(normalise(supabase), row.id).toEqual(normalise(sample));
    }
  });

  it("gives the same office-hours queue and count", async () => {
    const queue = await parity(() => listBookings());
    expect(queue.sample.length).toBeGreaterThan(0);
    expect(normalise(queue.supabase)).toEqual(normalise(queue.sample));
    const count = await parity(() => openBookingCount());
    expect(count.supabase).toBe(count.sample);
  });
});
