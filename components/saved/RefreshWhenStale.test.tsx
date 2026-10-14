import { render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { readSavedIds, savedCookieString } from "@/lib/saved";
import { RefreshWhenStale } from "./RefreshWhenStale";

// One router for the whole file, so the test can watch its refresh (the setup file's mock makes a new one each call).
const refresh = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

afterEach(() => {
  refresh.mockClear();
});

describe("RefreshWhenStale (shopping spec 5.5)", () => {
  it("does nothing when the list matches the saved cookie", () => {
    document.cookie = savedCookieString(["l-002", "l-001"], false);
    render(<RefreshWhenStale savedIds="l-002.l-001" shownIds="l-002.l-001" />);
    expect(refresh).not.toHaveBeenCalled();
    expect(readSavedIds()).toEqual(["l-002", "l-001"]);
  });

  it("fetches the list again when something was saved or removed since it was built", () => {
    document.cookie = savedCookieString(["l-003", "l-001"], false);
    render(<RefreshWhenStale savedIds="l-001" shownIds="l-001" />);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("does nothing when nothing is saved and the list was built empty", () => {
    render(<RefreshWhenStale savedIds="" shownIds="" />);
    expect(refresh).not.toHaveBeenCalled();
  });

  it("forgets a saved id whose listing no longer exists, and doesn't fetch the list again", () => {
    document.cookie = savedCookieString(["l-001", "gone"], false);
    render(<RefreshWhenStale savedIds="l-001.gone" shownIds="l-001" />);
    expect(readSavedIds()).toEqual(["l-001"]);
    expect(refresh).not.toHaveBeenCalled();
  });

  it("forgets every saved id when none of their listings exist any more", () => {
    document.cookie = savedCookieString(["gone-1", "gone-2"], false);
    render(<RefreshWhenStale savedIds="gone-1.gone-2" shownIds="" />);
    expect(readSavedIds()).toEqual([]);
    expect(refresh).not.toHaveBeenCalled();
  });

  it("forgets only the ids the server couldn't find, and still fetches the list again if something was saved since", () => {
    // The server built the list from l-001 and gone; meanwhile (say, in another tab) l-009 was saved.
    document.cookie = savedCookieString(["l-009", "l-001", "gone"], false);
    render(<RefreshWhenStale savedIds="l-001.gone" shownIds="l-001" />);
    expect(readSavedIds()).toEqual(["l-009", "l-001"]);
    expect(refresh).toHaveBeenCalledTimes(1);
  });
});
