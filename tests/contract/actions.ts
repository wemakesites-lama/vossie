import { afterEach, beforeEach } from "vitest";
import { readFormState } from "@/lib/auth/form-state";
import { SESSION_COOKIE } from "@/lib/auth/cookies";
import { hashToken } from "@/lib/auth/secrets";
import type { FormStateRow } from "@/lib/data/rows";
import { createSession } from "@/lib/data/sessions";
import { redirectSignalOf, resetRequest, withCookies, type FakeRequest } from "@/tests/helpers/next-request";
import { form } from "@/tests/helpers/staff";
import type { World, WorldAccountName } from "./world";

// Action contracts (C4/C5 plan decision 13): the real Server Action runs on both worlds, with the session set to a
// world account, so a gate that lives in the action on the sample store and in SQL on Supabase is proven on both. A
// test file mocks next/headers, next/navigation, next/server and next/cache with tests/helpers/next-request.ts over
// its own FakeRequest, and on Supabase also the client and session seams (tests/db/actions.ts); then:
//
//   actionContract(sampleWorld, request, { signIn: signInSample(request) }, (scenario) => { it(…) });

/** How a post ended: where it redirected (and how), or the 404, or neither. */
export type Posted = { redirect: string | null; type: string | undefined; notFound: boolean };

/** Signs a world account in for the posts that follow, and gives its id. */
export type SignIn = (world: World, name: WorldAccountName | null) => Promise<string | null>;

/** Runs `run` as that account, whatever else runs at the same time as another (C4/C5 plan Task 20). */
export type ActAs = <T>(world: World, name: WorldAccountName, run: () => Promise<T>) => Promise<T>;

export type ActionScenario = {
  readonly world: World;
  /** The browser is that account's from now on (null: signed out). Its id. */
  signIn(name: WorldAccountName | null): Promise<string | null>;
  /** Posts the form to the action, as the browser would, and says how it ended. Anything else it throws is rethrown. */
  post(
    action: (formData: FormData) => Promise<unknown>,
    fields: Readonly<Record<string, string | readonly string[] | File>>,
  ): Promise<Posted>;
  /**
   * Posts as that account for this one post, whoever is signed in, so two posts can run at once as two people (the
   * backend's `as`). The account's own form states are read with `noticeAs`.
   */
  postAs(
    name: WorldAccountName,
    action: (formData: FormData) => Promise<unknown>,
    fields: Readonly<Record<string, string | readonly string[] | File>>,
  ): Promise<Posted>;
  /** This session's state for a form (readFormState), such as a status line's. */
  notice(formKey: string): Promise<FormStateRow | null>;
  /** That account's state for a form, as `postAs` left it. */
  noticeAs(name: WorldAccountName, formKey: string): Promise<FormStateRow | null>;
  /** The cache tags the posts expired, in order (updateTag). */
  tags(): readonly string[];
};

/**
 * The sample store's sign-in: a stored session for the account, its token in the request's cookie (as
 * tests/helpers/staff.ts's signedInAs, timed from the real clock, since contracts run at the real time).
 */
export function signInSample(request: FakeRequest): SignIn {
  return async (world, name) => {
    request.cookies.delete(SESSION_COOKIE);
    if (name === null) return null;
    const { accountId, token } = await sampleSession(world, name);
    request.cookies.set(SESSION_COOKIE, token);
    return accountId;
  };
}

/** A stored sample session for the account, and its token. */
async function sampleSession(world: World, name: WorldAccountName): Promise<{ accountId: string; token: string }> {
  const accountId = await world.signedIn(name);
  const token = `token-contract-${name}`;
  const now = Date.now();
  await createSession({
    key: hashToken(token),
    accountId,
    createdAt: new Date(now),
    expiresAt: new Date(now + 30 * 24 * 60 * 60 * 1000),
  });
  return { accountId, token };
}

/** The sample store's `as`: a browser of its own, with that account's session cookie, for the length of the call. */
export const asSample: ActAs = async (world, name, run) => {
  const { token } = await sampleSession(world, name);
  return withCookies(new Map([[SESSION_COOKIE, token]]), run);
};

/**
 * Runs `scenarios` against a fresh world before each test, cleaned up after. `signIn` is the backend's (signInSample,
 * or tests/db/actions.ts's signInDb); `tidy` runs in cleanup before the world's undos (the db harness's form states).
 */
export function actionContract(
  makeWorld: () => World,
  request: FakeRequest,
  backend: { signIn: SignIn; tidy?: () => Promise<void>; as?: ActAs },
  scenarios: (scenario: () => ActionScenario) => void,
): void {
  let current: ActionScenario;
  beforeEach(() => {
    resetRequest(request);
    const world = makeWorld();
    const as: ActAs = backend.as ?? asSample;
    current = {
      world,
      signIn: (name) => backend.signIn(world, name),
      postAs: (name, action, fields) => as(world, name, () => current.post(action, fields)),
      noticeAs: (name, formKey) => as(world, name, () => readFormState(formKey)),
      async post(action, fields) {
        try {
          const signal = await redirectSignalOf(() => action(form(fields)));
          return { redirect: signal.url, type: signal.type, notFound: false };
        } catch (error) {
          if (error instanceof Error && error.message === "notFound") return { redirect: null, type: undefined, notFound: true };
          if (error instanceof Error && error.message === "Expected a redirect, but there was none") {
            return { redirect: null, type: undefined, notFound: false };
          }
          throw error;
        }
      },
      notice: (formKey) => readFormState(formKey),
      tags: () => request.updatedTags ?? [],
    };
  });
  afterEach(async () => {
    try {
      await backend.signIn(current.world, null);
      await backend.tidy?.();
    } finally {
      await current.world.cleanup();
    }
  });
  scenarios(() => current);
}
