import { inject } from "vitest";
import type { World } from "@/tests/contract/world";
import { testAdminClient, type DbClient } from "./accounts";
import { setViewer } from "./viewer";

// The local stack's world (2b plan decision 18, Task 13). Its accounts are the global setup's (tests/db/global-setup.ts).
// Its verbs write with the admin client, never through a function a test is checking, and each records an undo with
// undoLater(), which cleanup() runs newest first after each test, so the seed is the same after every test.

export type SupabaseWorld = World & {
  /** The secret key's client, for verbs and for checking what a function wrote. */
  readonly admin: DbClient;
  /** Records how to undo a write; cleanup() runs the undos newest first. */
  undoLater(undo: () => Promise<void>): void;
};

/** A Supabase world. Made before each test. */
export function supabaseWorld(): SupabaseWorld {
  const admin = testAdminClient();
  let undos: (() => Promise<void>)[] = [];
  return {
    name: "supabase",
    admin,
    undoLater(undo) {
      undos.push(undo);
    },
    async signedIn(name) {
      return inject("dbSessions")[name].id;
    },
    async asViewer(name, read) {
      setViewer(name);
      try {
        return await read(await this.signedIn(name));
      } finally {
        setViewer(null);
      }
    },
    async cleanup() {
      const pending = undos.reverse();
      undos = [];
      const errors: unknown[] = [];
      for (const undo of pending) {
        try {
          await undo();
        } catch (error) {
          errors.push(error);
        }
      }
      if (errors.length > 0) throw new AggregateError(errors, "The world's cleanup failed: the seed may have changed");
    },
  };
}
