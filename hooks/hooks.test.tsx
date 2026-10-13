import { act, renderHook } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { setCampusChoice } from "@/lib/campus";
import { setLowData } from "@/lib/low-data";
import { savedCookieString, toggleSaved } from "@/lib/saved";
import { mockMatchMedia } from "@/tests/helpers/dom";
import { useCampusChoice } from "./useCampusChoice";
import { useLowData } from "./useLowData";
import { isMotionAllowedNow, useMotionAllowed } from "./useMotionAllowed";
import { useReducedMotion } from "./useReducedMotion";
import { useSavedCount } from "./useSavedCount";

const campuses = [{ slug: "midrand" }, { slug: "pretoria" }];

function ServerValues() {
  const campus = useCampusChoice(campuses);
  const saved = useSavedCount();
  const lowData = useLowData();
  const reduced = useReducedMotion();
  const motion = useMotionAllowed();
  return <output>{`${campus}|${saved}|${lowData}|${reduced}|${motion}`}</output>;
}

describe("device preference hooks", () => {
  it("useCampusChoice defaults to all campuses and follows the cookie", () => {
    const { result } = renderHook(() => useCampusChoice(campuses));
    expect(result.current).toBe("all");
    act(() => {
      setCampusChoice("pretoria");
    });
    expect(result.current).toBe("pretoria");
  });

  it("useSavedCount counts saves on this device", () => {
    document.cookie = savedCookieString(["a", "b"], false);
    const { result } = renderHook(() => useSavedCount());
    expect(result.current).toBe(2);
    act(() => {
      toggleSaved("c");
    });
    expect(result.current).toBe(3);
  });

  it("useLowData follows the data saver switch", () => {
    const { result } = renderHook(() => useLowData());
    expect(result.current).toBe(false);
    act(() => {
      setLowData(true);
    });
    expect(result.current).toBe(true);
  });

  it("useReducedMotion reads the media query", () => {
    mockMatchMedia((query) => query.includes("reduce"));
    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(true);
  });

  it("allows motion only without reduced motion and without data saver", () => {
    const { result } = renderHook(() => useMotionAllowed());
    expect(result.current).toBe(true);
    expect(isMotionAllowedNow()).toBe(true);
    act(() => {
      setLowData(true);
    });
    expect(result.current).toBe(false);
    expect(isMotionAllowedNow()).toBe(false);
  });

  it("renders safe defaults on the server, whatever the device has stored", () => {
    setCampusChoice("pretoria");
    document.cookie = savedCookieString(["a"], false);
    setLowData(true);
    expect(renderToString(<ServerValues />)).toContain("null|0|false|true|false");
  });
});
