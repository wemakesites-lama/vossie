"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { dismissToast, getToast, subscribeToast } from "@/lib/toast";

const TOAST_MS = 4000;
const noToastOnServer = () => null;

export function ToastRegion() {
  const toast = useSyncExternalStore(subscribeToast, getToast, noToastOnServer);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const popover = popoverRef.current;
    const canPop = popover !== null && typeof popover.showPopover === "function";
    if (!toast) {
      if (canPop && popover.matches(":popover-open")) popover.hidePopover();
      return;
    }
    if (canPop && !popover.matches(":popover-open")) popover.showPopover();
    const timer = window.setTimeout(() => dismissToast(toast.id), TOAST_MS);
    return () => window.clearTimeout(timer);
  }, [toast]);

  return (
    <>
      <div role="status" aria-live="polite" className="sr-only">
        {toast?.message}
      </div>
      <div ref={popoverRef} popover="manual" aria-hidden="true" className="toast-pop">
        {toast && (
          <p key={toast.id} className="toast">
            {toast.message}
          </p>
        )}
      </div>
    </>
  );
}
