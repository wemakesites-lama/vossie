import { readFileSync } from "node:fs";
import { join } from "node:path";
import { brotliCompressSync, constants } from "node:zlib";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BOOT_SCRIPT, bootScript, WORKER_REGISTRATION } from "./boot-script";
import { INSTALL_PROMPT_EVENT } from "./install-event";
import { LOW_DATA_ATTR, LOW_DATA_KEY } from "./low-data";

type WindowWithPrompt = Window & { __vossieInstallPrompt?: Event | null };

function runBootScript() {
  // Runs the exact string the layout puts in <head>.
  new Function(BOOT_SCRIPT)();
}

function setSaveData(saveData: boolean) {
  Object.defineProperty(navigator, "connection", { configurable: true, value: { saveData } });
}

afterEach(() => {
  Reflect.deleteProperty(navigator, "connection");
});

describe("boot script", () => {
  it("turns data saver on when it was saved on", () => {
    localStorage.setItem(LOW_DATA_KEY, "1");
    runBootScript();
    expect(document.documentElement.hasAttribute(LOW_DATA_ATTR)).toBe(true);
  });

  it("follows the browser's Save-Data setting when nothing is saved", () => {
    setSaveData(true);
    runBootScript();
    expect(document.documentElement.hasAttribute(LOW_DATA_ATTR)).toBe(true);
  });

  it("respects a saved 'off' even when Save-Data is on", () => {
    localStorage.setItem(LOW_DATA_KEY, "0");
    setSaveData(true);
    runBootScript();
    expect(document.documentElement.hasAttribute(LOW_DATA_ATTR)).toBe(false);
  });

  it("still follows the browser's Save-Data setting when storage is blocked", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("Blocked", "SecurityError");
    });
    setSaveData(true);
    runBootScript();
    expect(document.documentElement.hasAttribute(LOW_DATA_ATTR)).toBe(true);
  });

  it("keeps the browser's install prompt for the footer button", () => {
    runBootScript();
    const announced = vi.fn();
    window.addEventListener(INSTALL_PROMPT_EVENT, announced);
    const prompt = new Event("beforeinstallprompt", { cancelable: true });
    window.dispatchEvent(prompt);
    expect(prompt.defaultPrevented).toBe(true);
    expect((window as WindowWithPrompt).__vossieInstallPrompt).toBe(prompt);
    expect(announced).toHaveBeenCalled();
    window.removeEventListener(INSTALL_PROMPT_EVENT, announced);
  });
});

const brotli = (text: string) =>
  brotliCompressSync(text, { params: { [constants.BROTLI_PARAM_QUALITY]: 5 } }).length;

describe("the service worker's registration (community actions spec 2.22)", () => {
  it("registers /sw.js once the page has loaded, and does nothing where workers don't exist", () => {
    const register = vi.fn(async () => undefined);
    Object.defineProperty(navigator, "serviceWorker", { configurable: true, value: { register } });
    new Function(bootScript(true))();
    expect(register).not.toHaveBeenCalled();
    window.dispatchEvent(new Event("load"));
    expect(register).toHaveBeenCalledWith("/sw.js");
    Reflect.deleteProperty(navigator, "serviceWorker");
    expect(() => new Function(bootScript(true))()).not.toThrow();
  });

  it("is only in production builds, and the rest of the script is unchanged", () => {
    expect(bootScript(false)).not.toContain("serviceWorker");
    expect(bootScript(true)).toBe(bootScript(false).replace(/\}\)\(\);$/, `${WORKER_REGISTRATION}})();`));
    expect(BOOT_SCRIPT).toBe(bootScript(false));
    expect(WORKER_REGISTRATION.length).toBeLessThanOrEqual(140);
  });

  it("costs under 100 B brotli-compressed in the script itself (the cut rule)", () => {
    expect(brotli(bootScript(true)) - brotli(bootScript(false))).toBeLessThan(100);
  });
});

describe("what the layout's BOOT_SCRIPT holds (community actions plan amendments 5 and 6)", () => {
  /** A fresh copy of the module, as a build of the given kind would see it, with the kill switch set as asked. */
  async function bootScriptOf(nodeEnv: string, workerOn: boolean): Promise<string> {
    vi.resetModules();
    vi.stubEnv("NODE_ENV", nodeEnv);
    vi.doMock("./offline", async (importOriginal) => ({
      ...(await importOriginal<typeof import("./offline")>()),
      WORKER_ON: workerOn,
    }));
    return (await import("./boot-script")).BOOT_SCRIPT;
  }

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.doUnmock("./offline");
    vi.resetModules();
  });

  it("registers the worker in a production build", async () => {
    expect(await bootScriptOf("production", true)).toBe(bootScript(true));
  });

  it("stops registering it when the kill switch is off (WORKER_ON = false), so no new device gets a worker", async () => {
    expect(await bootScriptOf("production", false)).toBe(bootScript(false));
  });

  it("never registers it in development or test", async () => {
    expect(await bootScriptOf("development", true)).toBe(bootScript(false));
    expect(await bootScriptOf("test", true)).toBe(bootScript(false));
  });

  it("stays a plain template literal, so client code that ever imported it couldn't carry the script", () => {
    // Client code doesn't import this module (install-event.test.ts checks). A call here, such as `bootScript(…)`,
    // can't be dropped by the bundler, and would put the registration in every page's JavaScript (the cut rule).
    const source = readFileSync(join(process.cwd(), "lib", "boot-script.ts"), "utf8");
    expect(source).toMatch(/^export const BOOT_SCRIPT = `/m);
    expect(source).not.toMatch(/^export const BOOT_SCRIPT = bootScript\(/m);
  });
});
