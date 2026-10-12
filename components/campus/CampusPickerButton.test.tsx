import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { onOverlayOpen } from "@/lib/overlays";
import { CampusPickerButton } from "./CampusPickerButton";

describe("CampusPickerButton", () => {
  it("opens the campus picker and hands it the button, so focus can come back", async () => {
    const user = userEvent.setup();
    const opened = vi.fn();
    const stop = onOverlayOpen("campus", opened);
    render(<CampusPickerButton className="chip">Shopping at Midrand</CampusPickerButton>);
    const button = screen.getByRole("button", { name: "Shopping at Midrand" });
    expect(button).toHaveAttribute("aria-haspopup", "dialog");
    await user.click(button);
    expect(opened).toHaveBeenCalledWith(button);
    stop();
  });
});
