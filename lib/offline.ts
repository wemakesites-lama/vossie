// The offline page (community actions spec 2.20, plan decision 25): one self-contained HTML document, with inline
// styles, no scripts, no images and no outside files, under 4 KB, so it works when the site's hashed files can't be
// fetched. "Vossie" is text (the crest PNG is 35 KB), in the system fonts the brand faces fall back to (app/fonts.ts),
// set once as --vos-font-*. Try again is a link to the same address: the worker shows this page in place of the one
// asked for, so "" is that page. The words beyond the spec's are samples for Lama to change.
// The service worker's source is here too (spec 2.21): it keeps the offline page and nothing else.

export const OFFLINE_PATH = "/offline";

export const OFFLINE_PAGE = `<!doctype html>
<html lang="en-ZA">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<meta name="theme-color" content="#15305d">
<title>You're offline · CampusCart</title>
<style>
:root{--vos-font-display:"Arial Narrow",sans-serif;--vos-font-text:ui-sans-serif,system-ui,sans-serif;--navy:#15305d;--ink:#373f41}
*{box-sizing:border-box}
body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px 16px;background:#fff;color:var(--ink);font-family:var(--vos-font-text);line-height:1.5}
main{max-width:30rem}
.brand{margin:0 0 24px;color:var(--navy);font-family:var(--vos-font-display);font-size:28px;font-weight:700;letter-spacing:.5px;text-transform:uppercase}
h1{margin:0;color:var(--navy);font-family:var(--vos-font-display);font-size:40px;line-height:1;text-transform:uppercase}
p{margin:16px 0 0;font-size:17px}
a{display:inline-flex;align-items:center;justify-content:center;min-height:44px;margin-top:24px;padding:0 28px;border-radius:999px;background:var(--navy);color:#fff;font-weight:600;text-decoration:none}
a:focus-visible{outline:2.5px solid var(--navy);outline-offset:3px}
</style>
</head>
<body>
<main>
<p class="brand">CampusCart</p>
<h1>You're offline</h1>
<p>CampusCart needs a connection to show listings and messages. Check your data or Wi-Fi.</p>
<a href="">Try again</a>
</main>
</body>
</html>`;

/** The worker's one cache (spec 2.21). The privacy policy names it. */
export const OFFLINE_CACHE = "vossie_offline";

/**
 * The kill switch (plan decision 25 and amendment 6): false makes /sw.js a worker that deletes its cache and
 * unregisters itself, and stops the boot script registering it. A device that already has the worker gets the off
 * worker through the browser's own update check.
 */
export const WORKER_ON = true;

/**
 * Change it whenever the worker's code changes: browsers compare /sw.js byte for byte on each visit, and a changed
 * worker installs again and fetches the offline page afresh. A change to the offline page changes the worker without
 * this (see pageHash).
 */
export const WORKER_VERSION = "2026-10-14.1";

/** A 32-bit FNV-1a of the text, in eight hex digits: a short fingerprint, not a secret. */
export function pageHash(text: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index++) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

/**
 * The service worker's source (spec 2.21, plan decision 25). Installed, it fetches the offline page fresh into
 * vossie_offline; started, it turns on navigation preload. It answers only GET page loads on this site: the preloaded
 * response, or the network's, or, when that fails, the offline page. It never touches posts, data fetches or other
 * sites, and never stores a page, so nothing personal stays on a shared phone (POPIA). Under 1 KB.
 *
 * The first line carries a hash of the offline page (amendment 6), so editing the page makes a different worker: a
 * device then installs it and keeps the new page, instead of the old copy it fetched when it first installed.
 */
export function workerSource(on: boolean = WORKER_ON, page: string = OFFLINE_PAGE): string {
  const cache = JSON.stringify(OFFLINE_CACHE);
  if (!on) {
    return `// CampusCart's service worker, switched off (${WORKER_VERSION}): it removes its cache and itself.
self.addEventListener("install",()=>self.skipWaiting());
self.addEventListener("activate",e=>e.waitUntil(caches.delete(${cache}).then(()=>self.registration.unregister())));
`;
  }
  return `// CampusCart's service worker (${WORKER_VERSION}, page ${pageHash(page)}): it keeps the offline page, and shows it when a page load fails.
const C=${cache},P=${JSON.stringify(OFFLINE_PATH)};
self.addEventListener("install",e=>e.waitUntil(caches.open(C).then(c=>c.add(new Request(P,{cache:"reload"}))).then(()=>self.skipWaiting())));
self.addEventListener("activate",e=>e.waitUntil(Promise.resolve(self.registration.navigationPreload&&self.registration.navigationPreload.enable()).then(()=>self.clients.claim())));
self.addEventListener("fetch",e=>{const r=e.request;if(r.method!=="GET"||r.mode!=="navigate"||new URL(r.url).origin!==location.origin)return;e.respondWith((async()=>{try{return(await e.preloadResponse)||(await fetch(r))}catch{return(await caches.match(P,{cacheName:C}))||Response.error()}})())});
`;
}
