"use client";

import { useRef, useState, type ChangeEvent, type InputHTMLAttributes } from "react";
import type { ShrinkTo } from "@/lib/photos/shrink";

type PhotoSearchFieldProps = {
  /** The file input's id, name, accepted types, description and class, worked out on the server (PhotoSearch). */
  input: InputHTMLAttributes<HTMLInputElement> & { id: string; name: string };
  /** How lib/photos/shrink.ts re-encodes the photo (AI features spec 5.1: the listing form's code). */
  shrinkTo: ShrinkTo;
  /** What the status line says while the photo is re-encoded. */
  busy: string;
};

/** How long a search waits for the re-encode before it goes with whatever the input holds (as the listing form). */
const HOLD_MS = 15_000;

/**
 * Snap to search's photo field (AI features spec 5.1 and 5.5), the page's only client code. A picked photo is
 * re-encoded by lib/photos/shrink.ts, loaded only now, so its hidden data is gone and it's at most 1,600px; the shrunk
 * copy takes the original's place in the input. A Search pressed meanwhile is held (a capture-phase listener on the
 * form, before React's form action) and sent once the re-encode settles, or after 15 seconds. If the code can't load,
 * the original goes, and the server strips it. Without JavaScript the plain form posts the original.
 */
export function PhotoSearchField({ input, shrinkTo, busy }: PhotoSearchFieldProps) {
  const [status, setStatus] = useState("");
  // The re-encode still to finish, or null; and whether a search is waiting for it.
  const shrinking = useRef<Promise<void> | null>(null);
  const held = useRef(false);

  function pick(event: ChangeEvent<HTMLInputElement>) {
    const element = event.currentTarget;
    const file = element.files?.[0];
    if (!file) {
      shrinking.current = null;
      return;
    }
    setStatus(busy);
    const run: Promise<void> = import("@/lib/photos/shrink")
      .then(({ shrink }) => shrink(file, shrinkTo))
      .then((small) => {
        // A photo picked since then wins: this one's copy is dropped.
        if (small === file || shrinking.current !== run) return;
        const transfer = new DataTransfer();
        transfer.items.add(small);
        element.files = transfer.files;
      })
      .catch(() => {})
      .finally(() => {
        if (shrinking.current !== run) return;
        shrinking.current = null;
        setStatus("");
      });
    shrinking.current = run;
  }

  function attach(element: HTMLInputElement | null) {
    const form = element?.form;
    if (!form) return;
    const hold = (event: SubmitEvent) => {
      if (!shrinking.current) return;
      event.preventDefault();
      if (held.current) return;
      held.current = true;
      const { submitter } = event;
      const awaited = shrinking.current;
      Promise.race([awaited, new Promise((go) => setTimeout(go, HOLD_MS))]).then(() => {
        // Nothing is held now, so the submit below goes through. Only the re-encode that was waited for is let go: a
        // photo picked meanwhile keeps its own, and after the 15 seconds the status line is cleared here, since that
        // re-encode's own end no longer will be (stage D review).
        held.current = false;
        if (shrinking.current === awaited) {
          shrinking.current = null;
          setStatus("");
        }
        form.requestSubmit(submitter);
      });
    };
    form.addEventListener("submit", hold, true);
    return () => form.removeEventListener("submit", hold, true);
  }

  return (
    <>
      <input type="file" {...input} ref={attach} onChange={pick} />
      <p role="status" className="sr-only">
        {status}
      </p>
    </>
  );
}
