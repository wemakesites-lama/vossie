import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mockMatchMedia } from "@/tests/helpers/dom";
import { InstallButton } from "./InstallButton";

const IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";

afterEach(() => {
  window.__vossieInstallPrompt = null;
});

describe("InstallButton", () => {
  it("shows nothing where the browser can't install", () => {
    const { container } = render(<InstallButton />);
    expect(container).toBeEmptyDOMElement();
  });

  it("uses the browser's install prompt when there is one", async () => {
    const user = userEvent.setup();
    const prompt = vi.fn().mockResolvedValue(undefined);
    window.__vossieInstallPrompt = Object.assign(new Event("beforeinstallprompt"), {
      prompt,
      userChoice: Promise.resolve({ outcome: "accepted" as const }),
    });
    render(<InstallButton />);
    await user.click(screen.getByRole("button", { name: "Add Vossie to your home screen" }));
    expect(prompt).toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Add Vossie to your home screen" })).not.toBeInTheDocument();
  });

  it("explains Share › Add to Home Screen on iPhone", async () => {
    const user = userEvent.setup();
    vi.spyOn(Navigator.prototype, "userAgent", "get").mockReturnValue(IPHONE);
    render(<InstallButton />);
    await user.click(screen.getByRole("button", { name: "Add Vossie to your home screen" }));
    const sheet = screen.getByRole("dialog", { name: "Add Vossie to your home screen" });
    expect(within(sheet).getByText(/Add to Home Screen/)).toBeInTheDocument();
  });

  it("shows nothing once installed", () => {
    mockMatchMedia((query) => query === "(display-mode: standalone)");
    const { container } = render(<InstallButton />);
    expect(container).toBeEmptyDOMElement();
  });
});
