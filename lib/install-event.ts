/**
 * The window event that says the browser's install prompt changed. It lives in a module of its own so the boot script
 * (server code, written into <head>) and the footer's install button (client code, lib/install.ts) can share the name
 * without the client importing the boot script, which imports the service worker's source (community actions plan,
 * Task 21): client code on every page must not reach lib/boot-script.ts or lib/offline.ts. Measured on 2026-10-19:
 * with the install button importing the boot script, none of the worker's text reached a script file, yet every
 * page's JavaScript was 527 B larger and the first visit loaded 9 script files instead of 8 (decision 63's chunk
 * threshold). Without that import it is 22 B smaller than before the worker: the old import had left four dead
 * JSON.stringify calls from the boot script in the client bundle. A test (install-event.test.ts) checks it.
 */
export const INSTALL_PROMPT_EVENT = "vossie:installprompt";
