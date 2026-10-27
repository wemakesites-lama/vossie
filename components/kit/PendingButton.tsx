"use client";

import type { MouseEvent, ReactNode } from "react";
import { useFormStatus } from "react-dom";

type PendingButtonProps = {
  children: ReactNode;
  /** What the button says while its form posts ("Marking as sold…"). */
  pendingLabel: string;
  className?: string;
  /** The button's own name and value. With them, it's pending only when it sent the form (photo-to-listing). */
  name?: string;
  value?: string;
};

/**
 * A form's submit button that says what's happening while the post is on its way, and ignores a second press then
 * (role views N2 plan decision 17). aria-disabled rather than disabled, so focus stays on it; the live region reads
 * the change. With a name and value, a different button's post leaves it as it is. Without JavaScript it is a plain submit button.
 */
export function PendingButton({ children, pendingLabel, className, name, value }: PendingButtonProps) {
  const { pending, data } = useFormStatus();
  const mine = pending && (name === undefined || data?.get(name) === value);
  const ignore = (event: MouseEvent<HTMLButtonElement>) => {
    if (mine) event.preventDefault();
  };
  return (
    <span aria-live="polite" className="pending-button">
      <button type="submit" name={name} value={value} className={className} aria-disabled={mine || undefined} onClick={ignore}>
        {mine ? pendingLabel : children}
      </button>
    </span>
  );
}
