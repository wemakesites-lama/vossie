"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { dismissToast, getToast, subscribeToast } from "@/lib/toast";

const TOAST_MS = 4000;
const noToastOnServer = () => null;

/**
 * Short confirmations (spec sections 6.4 and 9). The polite live region is always in the page, so
 * screen readers announce each message, except while a modal dialog is open: the rest of the page
 * is inert then. A flow that confirms with a toast must close its dialogs first, as the menu's
 * campus switch does. The visible pill is a manual popover, so it shows above open dialogs.
 */
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
    if (canPop) {
      // Re-show for every toast, so it lands above any dialog opened since the last one.
      if (popover.matches(":popover-open")) popover.hidePopover();
      popover.showPopover();
    }
    const timer = window.setTimeout(() => dismissToast(toast.id), TOAST_MS);
    return () => window.clearTimeout(timer);
  }, [toast]);

  return (
    <>
      <div role="status" aria-live="polite" className="sr-only">
        {toast && <span key={toast.id}>{toast.message}</span>}
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
