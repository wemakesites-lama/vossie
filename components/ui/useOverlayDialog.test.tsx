import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { openOverlay, type OverlayName } from "@/lib/overlays";
import { useOverlayDialog } from "./useOverlayDialog";

function TestDialog({
  onOpen,
  name = "search",
  label = "Test dialog",
}: {
  onOpen?: (trigger: HTMLElement | null, dialog: HTMLDialogElement) => void;
  name?: OverlayName;
  label?: string;
}) {
  const { dialogRef, close, onBackdropClick } = useOverlayDialog(name, onOpen);
  return (
    <dialog ref={dialogRef} aria-label={label} onClick={onBackdropClick}>
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

  it("leaves focus to an overlay that opened as this one closed, and that overlay gives it back", async () => {
    const user = userEvent.setup();
    render(
      <>
        <button type="button">Trigger</button>
        <TestDialog />
        <TestDialog name="campus" label="Hand-over dialog" />
      </>,
    );
    const trigger = screen.getByRole("button", { name: "Trigger" });
    trigger.focus();
    act(() => openOverlay("search", trigger));
    const first = screen.getByRole<HTMLDialogElement>("dialog", { name: "Test dialog" });

    // The first overlay hands over, as the menu does to the campus picker: the second opens with the same trigger,
    // and only then does the first one's close event fire (a browser queues that event).
    act(() => openOverlay("campus", trigger));
    const second = screen.getByRole("dialog", { name: "Hand-over dialog" });
    const secondClose = within(second).getByRole("button", { name: "Close" });
    secondClose.focus(); // a browser moves focus into a dialog opened as a modal; jsdom doesn't
    first.close();
    expect(first).not.toHaveAttribute("open");
    expect(secondClose).toHaveFocus();

    await user.click(secondClose);
    expect(second).not.toHaveAttribute("open");
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
    fireEvent.pointerDown(screen.getByText("Content"));
    fireEvent.click(screen.getByText("Content"));
    expect(dialog).toHaveAttribute("open");
    fireEvent.pointerDown(dialog);
    fireEvent.click(dialog);
    expect(dialog).not.toHaveAttribute("open");
  });

  it("stays open when a press that started inside ends on the backdrop", () => {
    render(<TestDialog />);
    act(() => openOverlay("search"));
    const dialog = screen.getByRole("dialog", { name: "Test dialog" });
    fireEvent.pointerDown(screen.getByText("Content"));
    fireEvent.click(dialog);
    expect(dialog).toHaveAttribute("open");
  });
});
