import { describe, expect, it } from "vitest";
import manifest from "./manifest";

describe("web app manifest", () => {
  it("describes an installable CampusCart app", () => {
    const app = manifest();
    expect(app.short_name).toBe("CampusCart");
    expect(app.start_url).toBe("/");
    expect(app.display).toBe("standalone");
    expect(app.theme_color).toBe("#15305D");
    expect(app.icons?.map((icon) => icon.sizes)).toEqual(["192x192", "512x512", "512x512"]);
    expect(app.icons?.some((icon) => icon.purpose === "maskable")).toBe(true);
  });
});
