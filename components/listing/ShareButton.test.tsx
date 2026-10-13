import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { shareLink, type ShareOutcome } from "@/lib/share";
import { getToast } from "@/lib/toast";
import { ShareButton } from "./ShareButton";

const outcome = vi.hoisted(() => ({ value: "copied" as ShareOutcome }));

vi.mock("@/lib/share", () => ({ shareLink: vi.fn(async () => outcome.value) }));

afterEach(() => {
  outcome.value = "copied";
  window.history.replaceState(null, "", "/");
  vi.mocked(shareLink).mockClear();
});

describe("ShareButton (spec 5.8)", () => {
  it("shares the listing's address, without a query or a hash", async () => {
    window.history.replaceState(null, "", "/listings/l-001?retry=x#more-from");
    render(<ShareButton title="Casio calculator" />);
    await userEvent.click(screen.getByRole("button", { name: "Share" }));
    expect(shareLink).toHaveBeenCalledWith("Casio calculator", `${window.location.origin}/listings/l-001`);
  });

  it("says the link was copied", async () => {
    render(<ShareButton title="Casio calculator" />);
    await userEvent.click(screen.getByRole("button", { name: "Share" }));
    await waitFor(() => expect(getToast()?.message).toBe("Link copied"));
  });

  it("says to copy from the address bar when it couldn't share", async () => {
    outcome.value = "failed";
    render(<ShareButton title="Casio calculator" />);
    await userEvent.click(screen.getByRole("button", { name: "Share" }));
    await waitFor(() => expect(getToast()?.message).toBe("Couldn't share. Copy the link from your address bar."));
  });

  it("stays quiet after the share sheet, whether it was used or closed", async () => {
    outcome.value = "cancelled";
    render(<ShareButton title="Casio calculator" />);
    await userEvent.click(screen.getByRole("button", { name: "Share" }));
    expect(getToast()).toBeNull();
  });

  it("takes a class for where it sits: the listing page's by default, or the storefront's", () => {
    const { unmount } = render(<ShareButton title="Casio calculator" />);
    expect(screen.getByRole("button", { name: "Share" })).toHaveClass("icon-btn", "listing-share");
    unmount();
    render(<ShareButton title="Tech corner" className="seller-share" />);
    const button = screen.getByRole("button", { name: "Share" });
    expect(button).toHaveClass("icon-btn", "seller-share");
    expect(button).not.toHaveClass("listing-share");
  });
});
