import { fireEvent, render, screen } from "@testing-library/react";
import { useRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { useSheetDrag } from "./useSheetDrag";

function Sheet({ onDismiss }: { onDismiss: () => void }) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const drag = useSheetDrag(sheetRef, onDismiss);
  return (
    <div ref={sheetRef} role="dialog" aria-label="Test sheet">
      <button type="button" aria-label="Drag handle" {...drag} />
    </div>
  );
}

function setup() {
  const onDismiss = vi.fn();
  render(<Sheet onDismiss={onDismiss} />);
  const sheet = screen.getByRole("dialog", { name: "Test sheet" });
  const handle = screen.getByRole("button", { name: "Drag handle" });
  // jsdom has no pointer capture: stand in for it, and see whether the hook asks for it.
  const setPointerCapture = vi.fn();
  handle.setPointerCapture = setPointerCapture;
  return { sheet, handle, setPointerCapture, onDismiss };
}

const primaryPress = { pointerId: 1, isPrimary: true, button: 0 };

describe("useSheetDrag", () => {
  it("follows the pointer down, never above where it started, and dismisses past 80px", () => {
    const { sheet, handle, setPointerCapture, onDismiss } = setup();
    fireEvent.pointerDown(handle, { ...primaryPress, clientY: 100 });
    expect(setPointerCapture).toHaveBeenCalledWith(1);

    fireEvent.pointerMove(handle, { pointerId: 1, clientY: 60 });
    expect(sheet.style.translate).toBe("0 0px");
    fireEvent.pointerMove(handle, { pointerId: 1, clientY: 150 });
    expect(sheet.style.translate).toBe("0 50px");
    expect(sheet.style.transition).toBe("none");
    expect(onDismiss).not.toHaveBeenCalled();

    fireEvent.pointerUp(handle, { pointerId: 1, clientY: 181 });
    expect(onDismiss).toHaveBeenCalledTimes(1);
    // The inline styles are cleared as it dismisses, so the closing animation starts from where it was dragged to.
    expect(sheet.style.translate).toBe("");
    expect(sheet.style.transition).toBe("");
  });

  it("springs back without dismissing when let go 80px or less down", () => {
    const { sheet, handle, onDismiss } = setup();
    fireEvent.pointerDown(handle, { ...primaryPress, clientY: 100 });
    fireEvent.pointerMove(handle, { pointerId: 1, clientY: 180 });
    expect(sheet.style.translate).toBe("0 80px");
    fireEvent.pointerUp(handle, { pointerId: 1, clientY: 180 });
    expect(onDismiss).not.toHaveBeenCalled();
    expect(sheet.style.translate).toBe("");
    expect(sheet.style.transition).toBe("");
  });

  it.each([
    { name: "the right button", press: { pointerId: 2, isPrimary: true, button: 2 } },
    { name: "a second finger, which is not the primary pointer", press: { pointerId: 2, isPrimary: false, button: 0 } },
  ])("ignores a press from $name, so it never starts a drag", ({ press }) => {
    const { sheet, handle, setPointerCapture, onDismiss } = setup();
    fireEvent.pointerDown(handle, { ...press, clientY: 100 });
    fireEvent.pointerMove(handle, { pointerId: 2, clientY: 250 });
    fireEvent.pointerUp(handle, { pointerId: 2, clientY: 250 });
    expect(setPointerCapture).not.toHaveBeenCalled();
    expect(sheet.style.translate).toBe("");
    expect(onDismiss).not.toHaveBeenCalled();
  });
});
