import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { isSaved } from "@/lib/saved";
import { getToast } from "@/lib/toast";
import { blockCookies } from "@/tests/helpers/dom";
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

  it("stays as it was, and says so, when cookies are blocked", async () => {
    const user = userEvent.setup();
    blockCookies();
    render(<SaveHeart id="l-001" title="Casio calculator" />);
    const heart = screen.getByRole("button", { name: "Save Casio calculator" });
    await user.click(heart);
    expect(heart).toHaveAttribute("aria-pressed", "false");
    expect(getToast()?.message).toBe("Couldn't update. Try again.");
  });

  it("takes an extra class, for the listing page's action bar", () => {
    render(<SaveHeart id="l-001" title="Casio calculator" className="save-heart-inline" />);
    expect(screen.getByRole("button", { name: "Save Casio calculator" })).toHaveClass("save-heart", "save-heart-inline");
  });

  it("starts pressed on the server when the page says it's saved (the Saved page, shopping spec 5.3)", () => {
    expect(renderToString(<SaveHeart id="l-001" title="Casio calculator" savedOnServer />)).toContain(
      'aria-pressed="true"',
    );
    expect(renderToString(<SaveHeart id="l-001" title="Casio calculator" />)).toContain('aria-pressed="false"');
  });
});
