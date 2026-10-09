import { useCallback, useEffect, useEffectEvent, useRef, type MouseEvent } from "react";
import { onOverlayOpen, type OverlayName } from "@/lib/overlays";

/**
 * Wires a native <dialog> to the overlay bus: opens it as a modal (so the browser traps focus
 * and Esc closes it), runs `onOpen` once it is open, and gives focus back to the trigger on close.
 * `onOpen` receives the dialog element, so callers never need their own ref to it.
 */
export function useOverlayDialog(
  name: OverlayName,
  onOpen?: (trigger: HTMLElement | null, dialog: HTMLDialogElement) => void,
) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
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
      if (trigger?.isConnected) trigger.focus();
    };
    dialog.addEventListener("close", onClose);
    return () => dialog.removeEventListener("close", onClose);
  }, []);

  const close = useCallback(() => {
    dialogRef.current?.close();
  }, []);

  /** Close when a click lands on the backdrop rather than the dialog's content. */
  const onBackdropClick = useCallback((event: MouseEvent<HTMLDialogElement>) => {
    if (event.target === event.currentTarget) event.currentTarget.close();
  }, []);

  return { dialogRef, close, onBackdropClick };
}
