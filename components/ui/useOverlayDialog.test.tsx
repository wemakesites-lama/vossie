import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { openOverlay } from "@/lib/overlays";
import { useOverlayDialog } from "./useOverlayDialog";

function TestDialog({
  onOpen,
}: {
  onOpen?: (trigger: HTMLElement | null, dialog: HTMLDialogElement) => void;
}) {
  const { dialogRef, close, onBackdropClick } = useOverlayDialog("search", onOpen);
  return (
    <dialog ref={dialogRef} aria-label="Test dialog" onClick={onBackdropClick}>
      <p>Content</p>
      <button type="button" onClick={close}>
        Close
      </button>
    </dialog>
  );
}

describe("useOverlayDialog", () => {
  it("opens from the bus, calls onOpen, and gives focus back to the trigger on close", async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn();
    render(
      <>
        <button type="button">Trigger</button>
        <TestDialog onOpen={onOpen} />
      </>,
    );
    const trigger = screen.getByRole("button", { name: "Trigger" });
    trigger.focus();
    act(() => openOverlay("search", trigger));
    const dialog = screen.getByRole("dialog", { name: "Test dialog" });
    expect(dialog).toHaveAttribute("open");
    expect(onOpen).toHaveBeenCalledWith(trigger, dialog);

    await user.click(within(dialog).getByRole("button", { name: "Close" }));
    expect(dialog).not.toHaveAttribute("open");
    expect(trigger).toHaveFocus();
  });

  it("ignores a second open while already open", () => {
    const onOpen = vi.fn();
    render(<TestDialog onOpen={onOpen} />);
    act(() => openOverlay("search"));
    act(() => openOverlay("search"));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("closes on a backdrop click but not on a click inside", () => {
    render(<TestDialog />);
    act(() => openOverlay("search"));
    const dialog = screen.getByRole("dialog", { name: "Test dialog" });
    fireEvent.click(screen.getByText("Content"));
    expect(dialog).toHaveAttribute("open");
    fireEvent.click(dialog);
    expect(dialog).not.toHaveAttribute("open");
  });
});
