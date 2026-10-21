import { AsyncLocalStorage } from "node:async_hooks";

// Record and replay at the data layer's edge (C4/C5 plan Task 22's tag table): a test file wraps lib/data's modules and
// lib/auth/session with wrapModule (in its vi.mock factories), runs a Server Action on the sample store while recording
// what each call answered, then runs the same post again on Supabase with the data "mocked" by those answers. Any
// difference in what the action then does (its tags, a call the sample never made) comes from the action's own
// backend-dependent code: sampleFollowUps, tokenTakenInSql and the like. Only the outermost call is recorded or replayed:
// a wrapped function that calls another runs it as it is.

type Answer = { done: boolean; async: boolean; value?: unknown; threw?: unknown };

let mode: "off" | "record" | "replay" = "off";
const log = new Map<string, Answer[]>();
const inside = new AsyncLocalStorage<true>();

const copy = <T>(value: T): T => {
  try {
    return structuredClone(value);
  } catch {
    return value;
  }
};

function wrap(key: string, fn: (...args: unknown[]) => unknown) {
  return function wrapped(...args: unknown[]): unknown {
    if (mode === "off" || inside.getStore()) return fn(...args);
    if (mode === "replay") {
      const answer = log.get(key)?.shift();
      if (!answer?.done) throw new Error(`Replay: ${key} was never called on the sample store at this point`);
      if (answer.async) return "threw" in answer ? Promise.reject(answer.threw) : Promise.resolve(copy(answer.value));
      if ("threw" in answer) throw answer.threw;
      return copy(answer.value);
    }
    // Recorded in the order the calls were made, filled in as each finishes.
    const answer: Answer = { done: false, async: false };
    log.set(key, [...(log.get(key) ?? []), answer]);
    let result: unknown;
    try {
      result = inside.run(true, () => fn(...args));
    } catch (error) {
      Object.assign(answer, { done: true, threw: error });
      throw error;
    }
    if (result instanceof Promise) {
      answer.async = true;
      return result.then(
        (value) => {
          Object.assign(answer, { done: true, value: copy(value) });
          return value;
        },
        (error: unknown) => {
          Object.assign(answer, { done: true, threw: error });
          throw error;
        },
      );
    }
    Object.assign(answer, { done: true, value: copy(result) });
    return result;
  };
}

/** The module with each of its functions recorded or replayed under `${name}.${function}`. Values pass through. */
export function wrapModule<M extends object>(name: string, original: M): M {
  return Object.fromEntries(
    Object.entries(original).map(([key, value]) => [
      key,
      typeof value === "function" ? wrap(`${name}.${key}`, value as (...args: unknown[]) => unknown) : value,
    ]),
  ) as M;
}

/** Runs `run` recording every wrapped call's answer, from a clean log. */
export async function recording<T>(run: () => Promise<T>): Promise<T> {
  log.clear();
  mode = "record";
  try {
    return await run();
  } finally {
    mode = "off";
  }
}

/** Runs `run` with every wrapped call answered from the log, in the order the sample store's calls were made. */
export async function replaying<T>(run: () => Promise<T>): Promise<T> {
  mode = "replay";
  try {
    return await run();
  } finally {
    mode = "off";
    log.clear();
  }
}
