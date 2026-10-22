import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PendingButton } from "./PendingButton";

const status = vi.hoisted(() => ({ pending: false }));
vi.mock("react-dom", async (original) => ({
  ...(await original<typeof import("react-dom")>()),
  useFormStatus: () => ({ pending: status.pending, data: null, method: null, action: null }),
}));

describe("PendingButton (role views N2 plan decision 17)", () => {
  it("submits its form on a press while nothing is posting", () => {
    status.pending = false;
    const submit = vi.fn((event: Event) => event.preventDefault());
    render(
      <form onSubmit={(event) => submit(event.nativeEvent)}>
        <PendingButton pendingLabel="Marking as sold…">Mark Desk lamp as sold</PendingButton>
      </form>,
    );
    const button = screen.getByRole("button", { name: "Mark Desk lamp as sold" });
    expect(button).not.toHaveAttribute("aria-disabled");
    fireEvent.click(button);
    expect(submit).toHaveBeenCalledTimes(1);
  });

  it("says what is happening and takes no second press while its form posts", () => {
    status.pending = true;
    const submit = vi.fn((event: Event) => event.preventDefault());
    render(
      <form onSubmit={(event) => submit(event.nativeEvent)}>
        <PendingButton pendingLabel="Marking as sold…">Mark Desk lamp as sold</PendingButton>
      </form>,
    );
    const button = screen.getByRole("button", { name: "Marking as sold…" });
    expect(button).toHaveAttribute("aria-disabled", "true");
    expect(button.closest("[aria-live]")).not.toBeNull();
    fireEvent.click(button);
    expect(submit).not.toHaveBeenCalled();
  });
});
