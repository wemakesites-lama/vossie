import { describe, expect, it, vi } from "vitest";
import { STATIC_PATHS } from "./sitemap";
import { OFFLINE_CACHE, OFFLINE_PAGE, OFFLINE_PATH, WORKER_VERSION, pageHash, workerSource } from "./offline";

const page = () => new DOMParser().parseFromString(OFFLINE_PAGE, "text/html");

describe("the offline page (community actions spec 2.20)", () => {
  it("is a whole document in South African English, kept out of search", () => {
    expect(OFFLINE_PAGE.startsWith("<!doctype html>")).toBe(true);
    expect(OFFLINE_PAGE).toContain('<html lang="en-ZA">');
    expect(OFFLINE_PAGE).toContain('<meta name="robots" content="noindex">');
    expect(OFFLINE_PATH).toBe("/offline");
    expect(STATIC_PATHS).not.toContain("/offline");
  });

  it("says you're offline, what to check, and Try again, a link to the same address", () => {
    const doc = page();
    expect([...doc.querySelectorAll("h1")].map((heading) => heading.textContent)).toEqual(["You're offline"]);
    expect(doc.body.textContent).toContain("Vossie needs a connection to show listings and messages. Check your data or Wi-Fi.");
    expect(doc.querySelector(".brand")?.textContent).toBe("Vossie");
    const tryAgain = doc.querySelector("a");
    expect(tryAgain?.textContent).toBe("Try again");
    expect(tryAgain?.getAttribute("href")).toBe("");
  });

  it("needs nothing else: no script, no image, no outside file, under 4 KB", () => {
    expect(OFFLINE_PAGE).not.toMatch(/<script|<img|<link|<svg|src=|url\(|@import/i);
    expect(new TextEncoder().encode(OFFLINE_PAGE).length).toBeLessThan(4096);
  });

  it("sets the brand faces' fallbacks once, as --vos-font-*, and uses navy on white", () => {
    expect(OFFLINE_PAGE).toContain('--vos-font-display:"Arial Narrow",sans-serif');
    expect(OFFLINE_PAGE).toContain("--vos-font-text:ui-sans-serif,system-ui,sans-serif");
    expect(OFFLINE_PAGE).toContain("#15305d");
    expect(OFFLINE_PAGE).toContain("background:#fff");
    expect(OFFLINE_PAGE).toContain("min-height:44px");
  });
});

type Listener = (event: Record<string, unknown>) => void;

/** Runs a worker's source against stand-ins for the browser's worker globals, and gives back what it touched. */
function runWorker(source: string, network: "online" | "offline" = "online") {
  const listeners = new Map<string, Listener>();
  const cache = { add: vi.fn<(request: unknown) => Promise<void>>(async () => undefined) };
  const caches = {
    open: vi.fn(async () => cache),
    match: vi.fn(async () => "the offline page"),
    delete: vi.fn(async () => true),
  };
  const self = {
    addEventListener: (type: string, listener: Listener) => listeners.set(type, listener),
    skipWaiting: vi.fn(async () => undefined),
    clients: { claim: vi.fn(async () => undefined) },
    registration: { navigationPreload: { enable: vi.fn(async () => undefined) }, unregister: vi.fn(async () => true) },
  };
  const fetch = vi.fn(async () => {
    if (network === "offline") throw new TypeError("Failed to fetch");
    return "the page from the network";
  });
  class FakeRequest {
    constructor(
      readonly url: string,
      readonly init?: unknown,
    ) {}
  }
  const Response = { error: () => "a network error" };
  new Function("self", "caches", "location", "fetch", "Request", "Response", source)(
    self,
    caches,
    { origin: "https://vossie.test" },
    fetch,
    FakeRequest,
    Response,
  );
  return { listeners, cache, caches, self, fetch };
}

/** A fetch event, and what the worker answered with (undefined when it let the browser carry on). */
async function fetchEvent(
  listeners: Map<string, Listener>,
  request: { method: string; mode: string; url: string },
  preloadResponse: unknown = undefined,
) {
  let answer: Promise<unknown> | undefined;
  listeners.get("fetch")!({ request, preloadResponse: Promise.resolve(preloadResponse), respondWith: (value: Promise<unknown>) => (answer = value) });
  return answer === undefined ? undefined : await answer;
}

const PAGE_LOAD = { method: "GET", mode: "navigate", url: "https://vossie.test/browse" };

describe("the service worker (community actions spec 2.21, plan decision 25)", () => {
  it("keeps only the offline page, fetched fresh, in vossie_offline when it installs", async () => {
    const { listeners, caches, cache, self } = runWorker(workerSource(true));
    let done: Promise<unknown> = Promise.resolve();
    listeners.get("install")!({ waitUntil: (value: Promise<unknown>) => (done = value) });
    await done;
    expect(OFFLINE_CACHE).toBe("vossie_offline");
    expect(caches.open).toHaveBeenCalledWith("vossie_offline");
    expect(cache.add).toHaveBeenCalledTimes(1);
    expect(cache.add.mock.calls[0][0]).toMatchObject({ url: OFFLINE_PATH, init: { cache: "reload" } });
    expect(self.skipWaiting).toHaveBeenCalled();
  });

  it("turns on navigation preload when it starts", async () => {
    const { listeners, self } = runWorker(workerSource(true));
    let done: Promise<unknown> = Promise.resolve();
    listeners.get("activate")!({ waitUntil: (value: Promise<unknown>) => (done = value) });
    await done;
    expect(self.registration.navigationPreload.enable).toHaveBeenCalled();
    expect(self.clients.claim).toHaveBeenCalled();
  });

  it("lets a page load through, using the preloaded response when there is one", async () => {
    const online = runWorker(workerSource(true));
    expect(await fetchEvent(online.listeners, PAGE_LOAD, "the preloaded page")).toBe("the preloaded page");
    expect(online.fetch).not.toHaveBeenCalled();
    expect(await fetchEvent(online.listeners, PAGE_LOAD)).toBe("the page from the network");
  });

  it("shows the offline page when a page load fails, and stores nothing", async () => {
    const offline = runWorker(workerSource(true), "offline");
    expect(await fetchEvent(offline.listeners, PAGE_LOAD)).toBe("the offline page");
    expect(offline.caches.match).toHaveBeenCalledWith(OFFLINE_PATH, { cacheName: "vossie_offline" });
    expect(offline.cache.add).not.toHaveBeenCalled();
  });

  it("never touches posts, data fetches or other sites", async () => {
    const { listeners } = runWorker(workerSource(true), "offline");
    expect(await fetchEvent(listeners, { ...PAGE_LOAD, method: "POST" })).toBeUndefined();
    expect(await fetchEvent(listeners, { ...PAGE_LOAD, mode: "cors" })).toBeUndefined();
    expect(await fetchEvent(listeners, { ...PAGE_LOAD, url: "https://example.com/" })).toBeUndefined();
  });

  it("is small, and never writes a response to a cache", () => {
    expect(new TextEncoder().encode(workerSource(true)).length).toBeLessThan(1024);
    expect(workerSource(true)).not.toMatch(/\.put\(/);
  });

  it("switched off, removes its cache and itself, and answers nothing", async () => {
    const { listeners, caches, self } = runWorker(workerSource(false));
    let done: Promise<unknown> = Promise.resolve();
    listeners.get("activate")!({ waitUntil: (value: Promise<unknown>) => (done = value) });
    await done;
    expect(caches.delete).toHaveBeenCalledWith("vossie_offline");
    expect(self.registration.unregister).toHaveBeenCalled();
    expect(listeners.has("fetch")).toBe(false);
  });
});

describe("the worker's version follows the page (community actions plan amendment 6)", () => {
  it("hashes text with a 32-bit FNV-1a, in eight hex digits", () => {
    // The published FNV-1a test vectors.
    expect(pageHash("")).toBe("811c9dc5");
    expect(pageHash("a")).toBe("e40c292c");
    expect(pageHash("foobar")).toBe("bf9cf968");
  });

  it("names its version and the offline page's hash in its first line", () => {
    const firstLine = workerSource(true).split("\n")[0];
    expect(firstLine).toContain(WORKER_VERSION);
    expect(firstLine).toContain(pageHash(OFFLINE_PAGE));
  });

  it("is a different file when the offline page changes, so browsers install it and fetch the page afresh", () => {
    const changed = OFFLINE_PAGE.replace("You're offline", "You are offline");
    expect(changed).not.toBe(OFFLINE_PAGE);
    expect(workerSource(true, changed)).not.toBe(workerSource(true));
    expect(workerSource(true, OFFLINE_PAGE)).toBe(workerSource(true));
  });

  it("is the same switched-off file whatever the page says", () => {
    expect(workerSource(false, "another page")).toBe(workerSource(false));
  });
});
