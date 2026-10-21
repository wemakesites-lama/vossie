// The contract tests' world (2b plan decision 18, Task 13): what a scenario needs from a backend, written once and
// implemented twice, by the sample store (tests/contract/sample-world.ts, in `pnpm test`) and by the local Supabase
// stack (tests/db/supabase-world.ts, in `pnpm test:db`). A contract (lib/data/contract/<area>.contract.ts) takes a
// function that makes a world, makes a fresh one before each test and cleans it up after.
//
// It grows per task: each C1 task adds the verbs its scenarios need, on both worlds (hideListing and pauseShop for the
// catalog, retirePickupPoint, addRequest and notificationsOf for requests, addRsvp for the Hub, recordDraw and addPin
// for Featured). Every verb on the Supabase side records an undo, so the seed is the same after each test.

/** The test accounts every world has. On Supabase, `pnpm test:db`'s global setup makes them (contract-<name>@vossie.test). */
export const WORLD_ACCOUNTS = ["asker", "shopper", "staff"] as const;

export type WorldAccountName = (typeof WORLD_ACCOUNTS)[number];

export interface World {
  readonly name: "sample" | "supabase";
  /** The account's id, signed in (a profile on Pretoria; "staff" holds the Admin role). */
  signedIn(name: WorldAccountName): Promise<string>;
  /**
   * Runs `read` with that account as the viewer, and gives it the account's id. On Supabase, the twins' forViewer()
   * is that account's session for the length of the call; in the sample store, the data layer takes the id itself.
   */
  asViewer<T>(name: WorldAccountName, read: (accountId: string) => Promise<T> | T): Promise<T>;
  /** Undoes what the test's verbs wrote, newest first. Runs after each test. */
  cleanup(): Promise<void>;
}
