"use client";

import Link from "next/link";
import { useId, useState, type FormEvent } from "react";

/**
 * Campus updates sign-up (spec section 6.6). There is no mailing list yet, so it only confirms
 * on screen: nothing is sent or stored (POPIA: don't collect what we can't use yet).
 *
 * Before JavaScript attaches, the browser would submit the form natively, which for a GET puts the address in
 * the URL, the history and the server logs. So the input has no `name` (a nameless control is never submitted;
 * `autoComplete` still drives autofill) and the form uses `method="dialog"`, which does nothing outside a <dialog>.
 */
export function NewsletterForm() {
  const id = useId();
  const [sent, setSent] = useState(false);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.reportValidity()) return;
    form.reset();
    setSent(true);
  }

  return (
    // Typing again clears the confirmation, so the next sign-up changes the live region and is announced too.
    // form.reset() fires no input event, so it doesn't clear the message it has just caused.
    <form method="dialog" onSubmit={onSubmit} onInput={() => setSent(false)} noValidate className="footer-signup">
      <label htmlFor={`${id}-email`} className="footer-label">
        Email address
      </label>
      <div className="footer-signup-row">
        <input
          id={`${id}-email`}
          type="email"
          required
          autoComplete="email"
          inputMode="email"
          placeholder="you@email.com"
          aria-describedby={`${id}-consent`}
          className="footer-input"
        />
        <button type="submit" className="btn btn-sky shrink-0">
          Get updates
        </button>
      </div>
      <p id={`${id}-consent`} className="footer-consent">
        Only campus updates, and you can unsubscribe at any time. See our <Link href="/privacy">privacy notice</Link>.
      </p>
      <p role="status" className="footer-signup-status">
        {sent ? "Thanks! Campus updates aren't live yet, so nothing was sent or saved. Sign-ups open soon." : null}
      </p>
    </form>
  );
}
