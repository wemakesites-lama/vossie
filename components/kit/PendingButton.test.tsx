import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PendingButton } from "./PendingButton";

const status = vi.hoisted(() => ({ pending: false, data: null as FormData | null }));
vi.mock("react-dom", async (original) => ({
  ...(await original<typeof import("react-dom")>()),
  useFormStatus: () => ({ pending: status.pending, data: status.data, method: null, action: null }),
}));

describe("PendingButton (role views N2 plan decision 17)", () => {
  beforeEach(() => {
    status.data = null;
  });

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

const sent = (fields: Record<string, string>) => {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) data.append(name, value);
  return data;
};

describe("PendingButton (photo-to-listing plan change 7)", () => {
  it("shows its pending words only when its own button sent the form", () => {
    Object.assign(status, { pending: true, data: sent({ intent: "publish" }) });
    const { rerender } = render(
      <PendingButton name="intent" value="suggest" pendingLabel="Reading your photo…">Fill in from my photo</PendingButton>,
    );
    expect(screen.getByRole("button").textContent).toBe("Fill in from my photo");
    expect(screen.getByRole("button").getAttribute("aria-disabled")).toBeNull();
    Object.assign(status, { pending: true, data: sent({ intent: "suggest" }) });
    rerender(<PendingButton name="intent" value="suggest" pendingLabel="Reading your photo…">Fill in from my photo</PendingButton>);
    expect(screen.getByRole("button").textContent).toBe("Reading your photo…");
    expect(screen.getByRole("button").getAttribute("aria-disabled")).toBe("true");
    expect(screen.getByRole("button").getAttribute("value")).toBe("suggest");
  });

  it("without a name, stays pending for any post, as before", () => {
    Object.assign(status, { pending: true, data: sent({ intent: "publish" }) });
    render(<PendingButton pendingLabel="Marking as sold…">Mark as sold</PendingButton>);
    expect(screen.getByRole("button").textContent).toBe("Marking as sold…");
  });
});
