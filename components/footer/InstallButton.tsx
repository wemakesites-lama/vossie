"use client";

import { useSyncExternalStore } from "react";
import { CloseIcon, PlusSquareIcon, ShareIcon } from "@/components/icons";
import { useOverlayDialog } from "@/components/ui/useOverlayDialog";
import { getInstallKind, promptInstall, subscribeInstall, type InstallKind } from "@/lib/install";
import { openOverlay } from "@/lib/overlays";

const unknownOnServer = (): InstallKind | null => null;

/** "Add Vossie to your home screen": the browser's prompt where there is one, a how-to sheet on iPhone. */
export function InstallButton() {
  const kind = useSyncExternalStore<InstallKind | null>(subscribeInstall, getInstallKind, unknownOnServer);

  if (kind === "prompt") {
    return (
      <button type="button" onClick={() => void promptInstall()} className="footer-install">
        <PlusSquareIcon className="size-5" />
        Add Vossie to your home screen
      </button>
    );
  }

  if (kind === "ios") {
    return (
      <>
        <button
          type="button"
          aria-haspopup="dialog"
          onClick={(event) => openOverlay("install-help", event.currentTarget)}
          className="footer-install"
        >
          <PlusSquareIcon className="size-5" />
          Add Vossie to your home screen
        </button>
        <IosInstallHelp />
      </>
    );
  }

  return null;
}

function IosInstallHelp() {
  const { dialogRef, close, onBackdropClick } = useOverlayDialog("install-help");
  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="install-help-title"
      onClick={onBackdropClick}
      className="sheet-dialog sheet-centred"
    >
      <div className="sheet-inner">
        <div className="flex items-start justify-between gap-3 pt-3">
          <h2 id="install-help-title" className="font-display text-[1.75rem] uppercase leading-none text-navy">
            Add Vossie to your home screen
          </h2>
          <button type="button" onClick={close} aria-label="Close" className="hdr-icon-btn -mr-2 -mt-2">
            <CloseIcon />
          </button>
        </div>
        <ol className="install-steps">
          <li>
            Tap <ShareIcon className="install-icon" /> <strong>Share</strong> in Safari’s toolbar.
          </li>
          <li>
            Choose <PlusSquareIcon className="install-icon" /> <strong>Add to Home Screen</strong>.
          </li>
          <li>
            Tap <strong>Add</strong>. Vossie opens like an app.
          </li>
        </ol>
      </div>
    </dialog>
  );
}
