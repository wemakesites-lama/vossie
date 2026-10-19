import { INSTALL_PROMPT_EVENT } from "./install-event";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

declare global {
  interface Window {
    /** Kept by the boot script when the browser offers to install the site. */
    __vossieInstallPrompt?: InstallPromptEvent | null;
  }
}

export type InstallKind = "prompt" | "ios" | "installed" | "unsupported";

/** What "Add Vossie to your home screen" can do in this browser right now. */
export function getInstallKind(): InstallKind {
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  if (standalone) return "installed";
  if (window.__vossieInstallPrompt) return "prompt";
  const userAgent = navigator.userAgent;
  const isIos = /iPhone|iPad|iPod/.test(userAgent) || (/Macintosh/.test(userAgent) && navigator.maxTouchPoints > 1);
  return isIos ? "ios" : "unsupported";
}

export function subscribeInstall(listener: () => void): () => void {
  window.addEventListener(INSTALL_PROMPT_EVENT, listener);
  return () => window.removeEventListener(INSTALL_PROMPT_EVENT, listener);
}

/** Show the browser's own install prompt (Chrome, Edge, Samsung Internet). It can only be used once. */
export async function promptInstall(): Promise<void> {
  const event = window.__vossieInstallPrompt;
  if (!event) return;
  window.__vossieInstallPrompt = null;
  window.dispatchEvent(new Event(INSTALL_PROMPT_EVENT));
  try {
    await event.prompt();
  } catch {
    // The browser refused (the prompt was already used, say). The button has gone, so there's nothing to undo.
  }
}
