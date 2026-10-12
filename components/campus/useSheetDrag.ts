import { useRef, type PointerEvent, type RefObject } from "react";

const DISMISS_DISTANCE = 80;

/**
 * Drag a bottom sheet down by its handle; letting go more than 80px down dismisses it.
 * Pointer only: Esc, the Close button and the backdrop cover everyone else.
 */
export function useSheetDrag(sheetRef: RefObject<HTMLElement | null>, onDismiss: () => void) {
  const startY = useRef<number | null>(null);

  function onPointerDown(event: PointerEvent<HTMLElement>) {
    if (event.button !== 0 || !event.isPrimary) return;
    startY.current = event.clientY;
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: PointerEvent<HTMLElement>) {
    const sheet = sheetRef.current;
    if (startY.current === null || !sheet) return;
    sheet.style.transition = "none";
    sheet.style.translate = `0 ${Math.max(0, event.clientY - startY.current)}px`;
  }

  function onPointerEnd(event: PointerEvent<HTMLElement>) {
    const sheet = sheetRef.current;
    if (startY.current === null || !sheet) return;
    const distance = event.clientY - startY.current;
    startY.current = null;
    // Clearing the inline styles in the same task as closing lets the sheet glide on from where it was dragged.
    sheet.style.transition = "";
    sheet.style.translate = "";
    if (distance > DISMISS_DISTANCE) onDismiss();
  }

  return { onPointerDown, onPointerMove, onPointerUp: onPointerEnd, onPointerCancel: onPointerEnd };
}
