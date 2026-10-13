import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ShareOutcome } from "@/lib/share";
import { getToast } from "@/lib/toast";
import { ShareButton } from "./ShareButton";

const outcome = vi.hoisted(() => ({ value: "copied" as ShareOutcome }));

vi.mock("@/lib/share", () => ({ shareLink: vi.fn(async () => outcome.value) }));

afterEach(() => {
  outcome.value = "copied";
});

describe("ShareButton (spec 5.8)", () => {
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
});
