import { describe, expect, it } from "vitest";
import { browseHeading } from "./heading";

describe("browseHeading (spec 4.1)", () => {
  it("says Everything with nothing chosen", () => {
    expect(browseHeading(null, null)).toEqual({ eyebrow: "Shop", heading: "Everything", title: "Browse" });
  });

  it("names the category", () => {
    expect(browseHeading(null, "Tech")).toEqual({ eyebrow: "Shop", heading: "Tech", title: "Tech" });
  });

  it("quotes a search, and says where it's searching", () => {
    expect(browseHeading("calculator", null)).toEqual({
      eyebrow: "Search",
      heading: "“calculator”",
      title: "“calculator”",
    });
    expect(browseHeading("calculator", "Tech").eyebrow).toBe("Search in Tech");
  });
});
