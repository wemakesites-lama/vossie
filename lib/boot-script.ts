import { LOW_DATA_ATTR, LOW_DATA_KEY } from "./low-data";

export const INSTALL_PROMPT_EVENT = "vossie:installprompt";

/**
 * Inline script for <head>, run before the page paints:
 * - turns data saver on from the saved choice, or from the browser's Save-Data setting when nothing is saved;
 * - keeps the browser's install prompt so the footer's "Add Vossie to your home screen" button can use it.
 */
export const BOOT_SCRIPT = `(function(){var d=document.documentElement;try{var v=localStorage.getItem(${JSON.stringify(LOW_DATA_KEY)});var c=navigator.connection;if(v==="1"||(v===null&&c&&c.saveData===true)){d.setAttribute(${JSON.stringify(LOW_DATA_ATTR)},"")}}catch(e){}window.addEventListener("beforeinstallprompt",function(e){e.preventDefault();window.__vossieInstallPrompt=e;window.dispatchEvent(new Event(${JSON.stringify(INSTALL_PROMPT_EVENT)}))});window.addEventListener("appinstalled",function(){window.__vossieInstallPrompt=null;window.dispatchEvent(new Event(${JSON.stringify(INSTALL_PROMPT_EVENT)}))})})();`;
