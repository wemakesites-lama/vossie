import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { isSaved } from "@/lib/saved";
import { getToast } from "@/lib/toast";
import { SaveHeart } from "./SaveHeart";

describe("SaveHeart (spec 7.8)", () => {
  it("saves on this device, says so, and shows it pressed", async () => {
    const user = userEvent.setup();
    render(<SaveHeart id="l-001" title="Casio calculator" />);
    const heart = screen.getByRole("button", { name: "Save Casio calculator" });
    expect(heart).toHaveAttribute("aria-pressed", "false");

    await user.click(heart);
    expect(heart).toHaveAttribute("aria-pressed", "true");
    expect(isSaved("l-001")).toBe(true);
    expect(getToast()?.message).toBe("Saved on this device");

    await user.click(heart);
    expect(heart).toHaveAttribute("aria-pressed", "false");
    expect(getToast()?.message).toBe("Removed from saved");
  });

  it("stays as it was, and says so, when storage is blocked", async () => {
    const user = userEvent.setup();
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    render(<SaveHeart id="l-001" title="Casio calculator" />);
    const heart = screen.getByRole("button", { name: "Save Casio calculator" });
    await user.click(heart);
    expect(heart).toHaveAttribute("aria-pressed", "false");
    expect(getToast()?.message).toBe("Couldn't update. Try again.");
  });
});
