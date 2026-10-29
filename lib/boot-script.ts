import { INSTALL_PROMPT_EVENT } from "./install-event";
import { LOW_DATA_ATTR, LOW_DATA_KEY } from "./low-data";
import { WORKER_ON } from "./offline";
import { NIGHT_BAR, NIGHT_BAR_ID, THEME_ATTR, THEME_KEY } from "./theme";

/**
 * Registers the service worker once the page has loaded, so it never competes with the page (community actions spec
 * 2.22). 132 characters in every page's HTML; the cut rule is 100 B compressed (plan decision 25). A failed
 * registration (a blocked or private browser) is caught, so it never shows as an error. It starts with a semicolon:
 * the script's last statement before it has none, and without it the two would run together into a syntax error.
 */
export const WORKER_REGISTRATION = `;if("serviceWorker"in navigator)addEventListener("load",function(){navigator.serviceWorker.register("/sw.js").catch(function(){})});`;

/**
 * Inline script for <head>, run before the page paints:
 * - turns data saver on from the saved choice, or from the browser's Save-Data setting when nothing is saved
 *   or storage can't be read;
 * - applies a chosen theme (Light, Dark or Night) and gives Night its browser bar colour, so a dark page never flashes
 *   white; with nothing saved, CSS follows the phone (Dark and Night themes spec 3.1). Same steps as setTheme in
 *   lib/theme.ts: keep the two in step;
 * - keeps the browser's install prompt so the footer's "Add Vossie to your home screen" button can use it;
 * - registers the service worker after load, in production builds (community actions spec 2.22).
 * Only the storage read sits inside `try`, so blocked storage never stops the Save-Data check.
 * BOOT_BODY is what runs inside the script's wrapper; BOOT_SCRIPT adds the wrapper and, in production, the registration.
 */
const BOOT_BODY = `var d=document.documentElement;var v=null;try{v=localStorage.getItem(${JSON.stringify(LOW_DATA_KEY)})}catch(e){}var c=navigator.connection;if(v==="1"||(v===null&&c&&c.saveData===true)){d.setAttribute(${JSON.stringify(LOW_DATA_ATTR)},"")}var t=null;try{t=localStorage.getItem(${JSON.stringify(THEME_KEY)})}catch(e){}if(t==="light"||t==="dark"||t==="night"){d.setAttribute(${JSON.stringify(THEME_ATTR)},t);if(t==="night"){var m=document.createElement("meta");m.id=${JSON.stringify(NIGHT_BAR_ID)};m.name="theme-color";m.content=${JSON.stringify(NIGHT_BAR)};document.head.prepend(m)}}window.addEventListener("beforeinstallprompt",function(e){e.preventDefault();window.__vossieInstallPrompt=e;window.dispatchEvent(new Event(${JSON.stringify(INSTALL_PROMPT_EVENT)}))});window.addEventListener("appinstalled",function(){window.__vossieInstallPrompt=null;window.dispatchEvent(new Event(${JSON.stringify(INSTALL_PROMPT_EVENT)}))})`;

/**
 * The boot script with the worker's registration at its end when `withWorker` (community actions spec 2.22). For
 * tests: the layout uses BOOT_SCRIPT, which is written out below instead of calling this.
 */
export function bootScript(withWorker: boolean): string {
  return `(function(){${BOOT_BODY}${withWorker ? WORKER_REGISTRATION : ""}})();`;
}

/**
 * What the layout puts in <head>. Production builds register the worker while WORKER_ON is set; development doesn't
 * (stale pages there). It stays a plain template literal, not a call to bootScript(), as a second guard (amendment 5):
 * a bundler can't drop a call, so if client code ever imported this file the registration would be in every page's
 * JavaScript. It doesn't: the event's name is in lib/install-event.ts, which client code imports instead.
 */
export const BOOT_SCRIPT = `(function(){${BOOT_BODY}${process.env.NODE_ENV === "production" && WORKER_ON ? WORKER_REGISTRATION : ""}})();`;
