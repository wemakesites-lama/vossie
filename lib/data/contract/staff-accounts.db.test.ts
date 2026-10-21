import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sampleAccounts } from "@/data/fixtures/accounts";
import { countAdmins, getStaffAccount, listStaffAccounts, type StaffAccount } from "@/lib/data/staff-accounts";
import { seedEmail } from "@/scripts/seed-sql";
import { dropContractAccounts, normalise, parity } from "@/tests/db/parity";
import { supabaseWorld } from "@/tests/db/supabase-world";
import { setViewer } from "@/tests/db/viewer";
import { staffAccountsContract } from "./staff-accounts.contract";

// Staff accounts' data on the local stack (C4/C5 plan Task 20): staff_accounts, staff_find_account, give_role and
// remove_role with the admin's session.
vi.mock("@/lib/data/supabase/clients", async (original) => (await import("@/tests/db/viewer")).withViewerSeam(await original()));
vi.mock("@/lib/data/supabase/auth-session", async (original) =>
  (await import("@/tests/db/viewer")).withSessionSeam(await original<object>()),
);

describe("staff accounts' data on the local stack (C4/C5 plan Task 20)", () => {
  staffAccountsContract(supabaseWorld);
});

describe("the Staff page gives the sample store's answer on the seed (C4/C5 plan Task 20)", () => {
  beforeEach(() => {
    setViewer("staff");
  });
  afterEach(() => {
    setViewer(null);
  });
  /** The seed's addresses are the fixtures' names on the test domain (seedEmail). */
  const seeded = (people: StaffAccount[]) => people.map((person) => ({ ...person, email: seedEmail(person.email) }));
  const staffIds = sampleAccounts.filter(({ account }) => account.roles.length > 0).map(({ account }) => account.id);

  it("lists the same people with their roles and the shops they mentor", async () => {
    const { sample, supabase } = await parity(() => listStaffAccounts());
    expect(sample.length).toBeGreaterThan(1);
    expect(normalise(dropContractAccounts(supabase, (person) => person.id))).toEqual(normalise(seeded(sample)));
  });

  it("gives each seed staff member's confirm page the same person, and counts the same admins", async () => {
    for (const id of staffIds) {
      const { sample, supabase } = await parity(() => getStaffAccount(process.env.VOSSIE_BACKEND === "supabase" ? (normalise(id) as string) : id));
      expect(normalise(supabase), id).toEqual(normalise(seeded([sample!]))[0]);
    }
    const { sample, supabase } = await parity(() => countAdmins());
    // The world's "staff" is an admin on the stack, and isn't in the sample store.
    expect(supabase).toBe(sample + 1);
  });
});
