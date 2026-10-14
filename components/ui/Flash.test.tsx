import { render } from "@testing-library/react";
import { Activity } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FLASH_COOKIE } from "@/lib/flash";
import { getToast, subscribeToast } from "@/lib/toast";
import { FlashContent } from "./Flash";
import { FlashToast } from "./FlashToast";

const flash = vi.hoisted(() => ({ code: undefined as string | undefined }));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (name === "vossie_flash" && flash.code ? { value: flash.code } : undefined),
  }),
}));

afterEach(() => {
  flash.code = undefined;
});

describe("flash toasts (accounts spec 2.13, plan decision 12)", () => {
  it("shows the message as a toast, and deletes the cookie so it shows once", () => {
    document.cookie = `${FLASH_COOKIE}=signed-out; Path=/`;
    render(<FlashToast message="You're signed out" />);
    expect(getToast()?.message).toBe("You're signed out");
    expect(document.cookie).not.toContain(FLASH_COOKIE);
  });

  it("shows once, even when Next keeps the page hidden in an <Activity> and shows it again on a link or Back", () => {
    document.cookie = `${FLASH_COOKIE}=signed-out; Path=/`;
    const shown: string[] = [];
    const stop = subscribeToast(() => {
      const toast = getToast();
      if (toast) shown.push(toast.message);
    });
    const page = (mode: "visible" | "hidden") => (
      <Activity mode={mode}>
        <FlashToast message="You're signed out" />
      </Activity>
    );
    const { rerender } = render(page("visible"));
    rerender(page("hidden"));
    rerender(page("visible"));
    rerender(page("hidden"));
    rerender(page("visible"));
    stop();
    // Showing it again would re-run the effect: the cookie, already deleted, says it was shown.
    expect(shown).toEqual(["You're signed out"]);
  });

  it("shows nothing when the cookie has gone", () => {
    render(<FlashToast message="You're signed out" />);
    expect(getToast()).toBeNull();
  });

  it("reads the code on the server and shows its words", async () => {
    flash.code = "deleted";
    // The server read the code from the browser's own cookie, so the browser has it too.
    document.cookie = `${FLASH_COOKIE}=deleted; Path=/`;
    render((await FlashContent())!);
    expect(getToast()?.message).toBe("Your account has been deleted");
  });

  it("shows nothing for a code it doesn't know, or none", async () => {
    flash.code = "<b>hi</b>";
    expect(await FlashContent()).toBeNull();
    flash.code = undefined;
    expect(await FlashContent()).toBeNull();
  });
});
