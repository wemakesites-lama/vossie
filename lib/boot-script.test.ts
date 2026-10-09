import { afterEach, describe, expect, it, vi } from "vitest";
import { BOOT_SCRIPT, INSTALL_PROMPT_EVENT } from "./boot-script";
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
