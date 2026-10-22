"use client";

import type { MouseEvent, ReactNode } from "react";
import { useFormStatus } from "react-dom";

type PendingButtonProps = {
  children: ReactNode;
  /** What the button says while its form posts ("Marking as sold…"). */
  pendingLabel: string;
  className?: string;
};

/**
 * A form's submit button that says what's happening while the post is on its way, and ignores a second press then
 * (role views N2 plan decision 17). aria-disabled rather than disabled, so focus stays on it; the live region reads
 * the change. Without JavaScript it is a plain submit button.
 */
export function PendingButton({ children, pendingLabel, className }: PendingButtonProps) {
  const { pending } = useFormStatus();
  const ignore = (event: MouseEvent<HTMLButtonElement>) => {
    if (pending) event.preventDefault();
  };
  return (
    <span aria-live="polite" className="pending-button">
      <button type="submit" className={className} aria-disabled={pending || undefined} onClick={ignore}>
        {pending ? pendingLabel : children}
      </button>
    </span>
  );
}
