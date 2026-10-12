import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { getRecentlyViewed } from "@/lib/recently-viewed";
import { RecordRecentlyViewed } from "./RecordRecentlyViewed";

describe("RecordRecentlyViewed", () => {
  it("remembers the listing on this device", () => {
    render(<RecordRecentlyViewed item={{ id: "l-001", title: "Calculator", image: { src: "/p.svg", alt: "" } }} />);
    expect(getRecentlyViewed().map((item) => item.id)).toEqual(["l-001"]);
  });
});
