import { vi } from "vitest";

/**
 * A stand-in for a supabase-js client in unit tests of the Supabase twins (Supabase phase B, Task 4): every call is
 * written down in order, and each awaited query answers with what the test queued for its table, function or bucket.
 * Nothing reaches a network. The database tests (`*.db.test.ts`) check the real thing against the local stack.
 *
 *   const db = fakeSupabase();
 *   db.answer("from:profiles", { data: { id: "u1" }, error: null });
 *   vi.mocked(forViewer).mockResolvedValue(db.client as never);
 *   … await twin() …
 *   expect(db.calls).toContainEqual(["from", "profiles"]);
 */
export type FakeAnswer = { data?: unknown; error?: unknown; count?: number | null };

export function fakeSupabase() {
  const calls: unknown[][] = [];
  const answers = new Map<string, FakeAnswer[]>();

  /** The next answer queued for `key`, or { data: null, error: null } when none is. */
  function next(key: string): FakeAnswer {
    const queued = answers.get(key);
    const answer = queued && queued.length > 0 ? queued.shift()! : { data: null, error: null };
    return { data: null, error: null, ...answer };
  }

  /** A query builder: every method chains and is written down; awaiting it gives the answer for `key`. */
  function builder(key: string): unknown {
    let answer: Promise<FakeAnswer> | null = null;
    const settle = () => (answer ??= Promise.resolve(next(key)));
    const proxy: unknown = new Proxy(
      {},
      {
        get(_, property) {
          if (property === "then") {
            return (resolve: (value: FakeAnswer) => unknown, reject: (reason: unknown) => unknown) => settle().then(resolve, reject);
          }
          return (...args: unknown[]) => {
            calls.push([String(property), ...args]);
            return proxy;
          };
        },
      },
    );
    return proxy;
  }

  const deleteUser = vi.fn(async (...args: unknown[]) => {
    calls.push(["auth.admin.deleteUser", ...args]);
    return next("auth.admin.deleteUser");
  });

  const client = {
    from(table: string) {
      calls.push(["from", table]);
      return builder(`from:${table}`);
    },
    rpc(fn: string, args?: unknown) {
      calls.push(["rpc", fn, args]);
      return builder(`rpc:${fn}`);
    },
    storage: {
      from(bucket: string) {
        return {
          remove: async (paths: string[]) => {
            calls.push(["storage.remove", bucket, paths]);
            return next(`storage:${bucket}`);
          },
        };
      },
    },
    auth: { admin: { deleteUser } },
  };

  return {
    client,
    calls,
    /** Queues answers for `key`: "from:<table>", "rpc:<function>", "storage:<bucket>" or "auth.admin.deleteUser". */
    answer(key: string, ...queued: FakeAnswer[]) {
      answers.set(key, [...(answers.get(key) ?? []), ...queued]);
    },
    /** The calls made after the call that matched `first`, up to the next "from" or "rpc": one query's chain. */
    chainOf(kind: "from" | "rpc", name: string, nth = 0): unknown[][] {
      const starts = calls.flatMap((call, index) => (call[0] === kind && call[1] === name ? [index] : []));
      const start = starts[nth];
      if (start === undefined) return [];
      const end = calls.findIndex((call, index) => index > start && (call[0] === "from" || call[0] === "rpc"));
      return calls.slice(start, end === -1 ? undefined : end);
    },
  };
}
