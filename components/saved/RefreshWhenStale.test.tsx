import { render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { savedCookieString } from "@/lib/saved";
import { RefreshWhenStale } from "./RefreshWhenStale";

// One router for the whole file, so the test can watch its refresh (the setup file's mock makes a new one each call).
const refresh = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

afterEach(() => {
  refresh.mockClear();
});

describe("RefreshWhenStale (shopping spec 5.3)", () => {
  it("does nothing when the list matches the saved cookie", () => {
    document.cookie = savedCookieString(["l-002", "l-001"], false);
    render(<RefreshWhenStale savedIds="l-002.l-001" />);
    expect(refresh).not.toHaveBeenCalled();
  });

  it("fetches the list again when something was saved or removed since it was built", () => {
    document.cookie = savedCookieString(["l-003", "l-001"], false);
    render(<RefreshWhenStale savedIds="l-001" />);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("does nothing when nothing is saved and the list was built empty", () => {
    render(<RefreshWhenStale savedIds="" />);
    expect(refresh).not.toHaveBeenCalled();
  });
});
