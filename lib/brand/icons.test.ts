import { describe, expect, it } from "vitest";
import { MARK, MARK_CENTRE_X } from "./cart-mark";
import { FAVICON, ICON_FILES } from "./icons";

describe("ICON_FILES", () => {
  it("lists every icon file the app serves, once", () => {
    expect(ICON_FILES.map((icon) => icon.file).sort()).toEqual([
      "app/apple-icon.png",
      "app/icon.png",
      "public/icons/icon-192.png",
      "public/icons/icon-512.png",
      "public/icons/icon-maskable-512.png",
    ]);
    expect(FAVICON.images.map((image) => image.size)).toEqual([16, 32, 48]);
  });

  it("uses the small cut at 32 px and under, the full mark above (logo spec 2.1)", () => {
    for (const image of FAVICON.images) expect(image.cut).toBe(image.size <= 32 ? "small" : "full");
    // icon.png is 64 × 64 but browsers show it at 32 or 16.
    expect(ICON_FILES.find((icon) => icon.file === "app/icon.png")?.cut).toBe("small");
  });

  it("keeps the maskable icon's mark inside the safe circle, 40% of the size from the centre", () => {
    const maskable = ICON_FILES.find((icon) => icon.file.includes("maskable"))!;
    const { box } = MARK[maskable.cut];
    const scale = (maskable.size * maskable.markWidth) / box.width;
    // Centred on the ink, so the handle's top-left corner is the farthest point from the centre.
    const left = (MARK_CENTRE_X - box.x) * scale;
    const up = (box.height / 2) * scale;
    expect(Math.hypot(left, up)).toBeLessThanOrEqual(maskable.size * 0.4);
  });
});
