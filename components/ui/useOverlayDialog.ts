import { useCallback, useEffect, useEffectEvent, useRef, type MouseEvent } from "react";
import { onOverlayOpen, type OverlayName } from "@/lib/overlays";

/**
 * Wires a native <dialog> to the overlay bus: opens it as a modal (so the browser traps focus
 * and Esc closes it), runs `onOpen` once it is open, and gives focus back to the trigger on close.
 * `onOpen` receives the dialog element, so callers never need their own ref to it.
 * The dialog must render on the first commit and stay mounted, as the shell's overlays do.
 */
export function useOverlayDialog(
  name: OverlayName,
  onOpen?: (trigger: HTMLElement | null, dialog: HTMLDialogElement) => void,
) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const pressedOnBackdropRef = useRef(false);
  const handleOpen = useEffectEvent((trigger: HTMLElement | null, dialog: HTMLDialogElement) => {
    onOpen?.(trigger, dialog);
  });

  useEffect(() => {
    return onOverlayOpen(name, (trigger) => {
      const dialog = dialogRef.current;
      if (!dialog || dialog.open) return;
      returnFocusRef.current = trigger;
      dialog.showModal();
      handleOpen(trigger, dialog);
    });
  }, [name]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const onClose = () => {
      const trigger = returnFocusRef.current;
      returnFocusRef.current = null;
      // Another overlay opened as this one closed (the menu hands over to the campus picker). That overlay
      // owns focus now, and gives it back when it closes.
      if (document.querySelector("dialog[open]")) return;
      if (trigger?.isConnected) trigger.focus();
    };
    const onPointerDown = (event: Event) => {
      pressedOnBackdropRef.current = event.target === dialog;
    };
    dialog.addEventListener("close", onClose);
    dialog.addEventListener("pointerdown", onPointerDown);
    return () => {
      dialog.removeEventListener("close", onClose);
      dialog.removeEventListener("pointerdown", onPointerDown);
    };
  }, []);

  const close = useCallback(() => {
    dialogRef.current?.close();
  }, []);

  /**
   * Close when a click both starts and ends on the backdrop. A drag that started inside (selecting
   * text in a search box, say) and ends outside keeps it open. The <dialog> itself must have no
   * padding: put padding on an inner wrapper, as the shell's dialogs do.
   */
  const onBackdropClick = useCallback((event: MouseEvent<HTMLDialogElement>) => {
    if (event.target === event.currentTarget && pressedOnBackdropRef.current) event.currentTarget.close();
  }, []);

  return { dialogRef, close, onBackdropClick };
}
