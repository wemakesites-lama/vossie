/**
 * Stand-ins for next/headers, next/navigation and next/server in unit tests of server code (accounts plan, Task 4).
 * The request is a plain object made with vi.hoisted, so the vi.mock factories can reach it:
 *
 *   const request = vi.hoisted(
 *     (): FakeRequest => ({ cookies: new Map(), sent: new Map(), proto: "http" }),
 *   );
 *   vi.mock("next/headers", async () => (await import("@/tests/helpers/next-request")).nextHeaders(request));
 *   vi.mock("next/navigation", async () => (await import("@/tests/helpers/next-request")).nextNavigation());
 *   vi.mock("next/server", async () => (await import("@/tests/helpers/next-request")).nextServer());
 *   vi.mock("next/cache", async () => (await import("@/tests/helpers/next-request")).nextCache(request));
 *
 * Call resetRequest(request) in beforeEach.
 */
export type FakeRequest = {
  /** The cookies the browser sends, by name. A write changes them, as the browser would on the response. */
  cookies: Map<string, string>;
  /** Every cookie the response set or deleted, by name, with its options. A delete records maxAge 0. */
  sent: Map<string, { value: string; options: Record<string, unknown> }>;
  /** The x-forwarded-proto header. */
  proto: string;
  /** Set when a Server Action called refresh() from next/cache (messaging plan decision 6). */
  refreshed?: boolean;
  /** The cache tags a Server Action expired with updateTag, in order (selling plan, Task 4). */
  updatedTags?: string[];
};

export function resetRequest(request: FakeRequest): void {
  request.cookies.clear();
  request.sent.clear();
  request.proto = "http";
  request.refreshed = false;
  request.updatedTags = [];
}

export function nextHeaders(request: FakeRequest) {
  return {
    cookies: async () => ({
      get: (name: string) => (request.cookies.has(name) ? { name, value: request.cookies.get(name)! } : undefined),
      set: (name: string, value: string, options: Record<string, unknown> = {}) => {
        request.sent.set(name, { value, options });
        if (options.maxAge === 0) request.cookies.delete(name);
        else request.cookies.set(name, value);
      },
      delete: (name: string) => {
        request.sent.set(name, { value: "", options: { maxAge: 0 } });
        request.cookies.delete(name);
      },
    }),
    headers: async () => ({
      get: (name: string) => (name === "x-forwarded-proto" ? request.proto : null),
    }),
  };
}

/** What the stand-in redirect() throws: where it was going, and how ("push" or "replace"). */
export class RedirectSignal extends Error {
  constructor(
    readonly url: string,
    readonly type: string | undefined,
  ) {
    super(`redirect to ${url}`);
    this.name = "RedirectSignal";
  }
}

export function nextNavigation() {
  return {
    redirect: (url: string, type?: string): never => {
      throw new RedirectSignal(url, type);
    },
    notFound: (): never => {
      throw new Error("notFound");
    },
    RedirectType: { push: "push", replace: "replace" },
    usePathname: () => "/",
  };
}

export function nextServer() {
  return { connection: async () => undefined };
}

/** Runs `run` and gives back the redirect it ended with. Fails when it didn't redirect. */
export async function redirectOf(run: () => Promise<unknown>): Promise<string> {
  const signal = await redirectSignalOf(run);
  return signal.url;
}

/** As redirectOf, with the redirect's type too. */
export async function redirectSignalOf(run: () => Promise<unknown>): Promise<RedirectSignal> {
  try {
    await run();
  } catch (error) {
    if (error instanceof Error && error.name === "RedirectSignal") return error as RedirectSignal;
    throw error;
  }
  throw new Error("Expected a redirect, but there was none");
}

/**
 * Stands in for next/cache (messaging plan, Task 6; selling plan, Task 4): refresh() and updateTag() note what they
 * were asked, and the cached readers' cacheTag() and cacheLife() do nothing, as there's no cache outside Next.
 */
export function nextCache(request: FakeRequest) {
  return {
    refresh: () => {
      request.refreshed = true;
    },
    updateTag: (tag: string) => {
      request.updatedTags = [...(request.updatedTags ?? []), tag];
    },
    cacheTag: () => {},
    cacheLife: () => {},
  };
}
