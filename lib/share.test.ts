import { afterEach, describe, expect, it, vi } from "vitest";
import { shareLink } from "./share";

const define = (name: "share" | "clipboard", value: unknown) =>
  Object.defineProperty(navigator, name, { configurable: true, value });

afterEach(() => {
  Reflect.deleteProperty(navigator, "share");
  Reflect.deleteProperty(navigator, "clipboard");
});

describe("shareLink (spec 5.8)", () => {
  it("uses the share sheet where there is one", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    define("share", share);
    expect(await shareLink("Casio calculator", "https://vossie.example/listings/l-001")).toBe("shared");
    expect(share).toHaveBeenCalledWith({ title: "Casio calculator", url: "https://vossie.example/listings/l-001" });
  });

  it("treats closing the share sheet as cancelled, not failed", async () => {
    define("share", vi.fn().mockRejectedValue(new DOMException("Closed", "AbortError")));
    expect(await shareLink("x", "https://vossie.example")).toBe("cancelled");
  });

  it("copies the link where there's no share sheet, or the share sheet fails", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    define("clipboard", { writeText });
    expect(await shareLink("x", "https://vossie.example/a")).toBe("copied");
    expect(writeText).toHaveBeenCalledWith("https://vossie.example/a");

    define("share", vi.fn().mockRejectedValue(new Error("Not allowed")));
    expect(await shareLink("x", "https://vossie.example/b")).toBe("copied");
  });

  it("fails when it can neither share nor copy", async () => {
    define("clipboard", { writeText: vi.fn().mockRejectedValue(new Error("Denied")) });
    expect(await shareLink("x", "https://vossie.example")).toBe("failed");
    Reflect.deleteProperty(navigator, "clipboard");
    expect(await shareLink("x", "https://vossie.example")).toBe("failed");
  });
});
