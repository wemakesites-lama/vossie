import { describe, expect, it, vi } from "vitest";
import { onOverlayOpen, openOverlay } from "./overlays";

describe("overlay bus", () => {
  it("passes the trigger to listeners of that overlay only", () => {
    const menu = vi.fn();
    const search = vi.fn();
    const offMenu = onOverlayOpen("menu", menu);
    const offSearch = onOverlayOpen("search", search);
    const trigger = document.createElement("button");
    openOverlay("menu", trigger);
    expect(menu).toHaveBeenCalledWith(trigger);
    expect(search).not.toHaveBeenCalled();
    offMenu();
    openOverlay("menu");
    expect(menu).toHaveBeenCalledTimes(1);
    offSearch();
  });
});
