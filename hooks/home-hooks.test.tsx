import { act, renderHook } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { recordRecentlyViewed } from "@/lib/recently-viewed";
import { toggleSaved } from "@/lib/saved";
import { useIsSaved } from "./useIsSaved";
import { useRecentlyViewed } from "./useRecentlyViewed";

function ServerValues() {
  const saved = useIsSaved("l-001");
  const viewed = useRecentlyViewed();
  return <output>{`${saved}|${viewed.length}`}</output>;
}

describe("homepage device hooks", () => {
  it("useIsSaved follows saves on this device", () => {
    const { result } = renderHook(() => useIsSaved("l-001"));
    expect(result.current).toBe(false);
    act(() => {
      toggleSaved("l-001");
    });
    expect(result.current).toBe(true);
  });

  it("useRecentlyViewed follows listings viewed on this device", () => {
    const { result } = renderHook(() => useRecentlyViewed());
    expect(result.current).toEqual([]);
    act(() => recordRecentlyViewed({ id: "l-001", title: "Calculator", image: { src: "/p.svg", alt: "" } }));
    expect(result.current.map((item) => item.id)).toEqual(["l-001"]);
  });

  it("render nothing saved and nothing viewed on the server", () => {
    localStorage.setItem("vossie_saved", JSON.stringify(["l-001"]));
    expect(renderToString(<ServerValues />)).toContain("false|0");
  });
});
