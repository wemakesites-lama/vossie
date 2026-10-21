import type { AccountRow } from "@/lib/data/rows";
import { resetSampleStore, sampleStore } from "@/lib/data/store";
import type { World, WorldAccountName } from "./world";

// The sample store's world (2b plan Task 13): a fresh store for each test (resetSampleStore, as the unit tests do), and
// verbs that write it as the unit tests do. It never reaches Supabase (lib/data/boundaries.test.ts).

/** The sample account for a world account: the same email as on Supabase, a profile on Pretoria, "staff" an Admin. */
function accountRow(name: WorldAccountName): AccountRow {
  return {
    id: `acc-contract-${name}`,
    email: `contract-${name}@vossie.test`,
    firstName: name[0].toUpperCase() + name.slice(1),
    campusSlug: "pretoria",
    roles: name === "staff" ? ["admin"] : [],
    createdAt: "2026-10-01T08:00:00.000Z",
  };
}

/** A sample world. Made before each test: it starts from a fresh store. */
export function sampleWorld(): World {
  resetSampleStore();
  return {
    name: "sample",
    async signedIn(name) {
      const accounts = sampleStore().accounts;
      const row = accountRow(name);
      if (!accounts.has(row.id)) accounts.set(row.id, row);
      return row.id;
    },
    async asViewer(name, read) {
      return read(await this.signedIn(name));
    },
    async cleanup() {
      // Nothing to undo: the next test's world starts from a fresh store.
    },
  };
}
