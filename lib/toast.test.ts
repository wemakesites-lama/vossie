import { describe, expect, it, vi } from "vitest";
import { dismissToast, getToast, showToast, subscribeToast } from "./toast";

describe("toast store", () => {
  it("shows one toast at a time and only dismisses the matching id", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeToast(listener);
    showToast("First");
    const first = getToast();
    showToast("Second");
    expect(getToast()?.message).toBe("Second");
    dismissToast(first!.id);
    expect(getToast()?.message).toBe("Second");
    dismissToast();
    expect(getToast()).toBeNull();
    expect(listener).toHaveBeenCalledTimes(3);
    unsubscribe();
  });
});
