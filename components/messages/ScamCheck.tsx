import { SCAM_TIPS, type ScamWarning } from "@/lib/messaging/scam-check";

/**
 * "Check this before you send" (messaging spec 2.3, plan decision 9): the tip for each kind of scam word found, and
 * Send anyway, which posts the form again with anyway=yes. It sits inside the form, after Send, so Enter in a field
 * never sends anyway. Like D's error summary, it's an alert, and the browser focuses it on a page load (D decision 11).
 */
export function ScamCheck({ warnings, idPrefix }: { warnings: readonly ScamWarning[]; idPrefix: string }) {
  if (warnings.length === 0) return null;
  const titleId = `${idPrefix}-check-title`;
  return (
    <div role="alert" tabIndex={-1} autoFocus aria-labelledby={titleId} className="msg-check">
      <h2 id={titleId} className="msg-check-title">
        Check this before you send
      </h2>
      <ul className="msg-check-list">
        {warnings.map((kind) => (
          <li key={kind}>{SCAM_TIPS.get(kind)}</li>
        ))}
      </ul>
      <p className="msg-check-hint">Change your message and press Send, or send it as it is.</p>
      <button type="submit" name="anyway" value="yes" className="btn btn-outline text-navy">
        Send anyway
      </button>
    </div>
  );
}
