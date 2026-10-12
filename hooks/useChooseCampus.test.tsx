import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { getCampusCookieValue } from "@/lib/campus";
import { getToast } from "@/lib/toast";
import { useChooseCampus } from "./useChooseCampus";

// The shared setup's router mock can't be asserted on, so this file has its own.
const router = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
  prefetch: vi.fn(),
  back: vi.fn(),
  forward: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => router,
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));

const campuses = [
  { slug: "midrand", name: "Midrand" },
  { slug: "pretoria", name: "Pretoria" },
];

describe("useChooseCampus", () => {
  it("remembers the campus, confirms it and re-renders the campus-aware sections", () => {
    const { result } = renderHook(() => useChooseCampus(campuses));
    act(() => result.current("midrand"));
    expect(getCampusCookieValue()).toBe("midrand");
    expect(getToast()?.message).toBe("Showing Midrand first");
    expect(router.refresh).toHaveBeenCalledTimes(1);
  });

  it("confirms all campuses in words", () => {
    const { result } = renderHook(() => useChooseCampus(campuses));
    act(() => result.current("all"));
    expect(getToast()?.message).toBe("Showing all campuses");
  });
});
