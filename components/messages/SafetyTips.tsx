import Link from "next/link";
import { SAFETY_TIPS } from "@/lib/messaging/scam-check";

/**
 * The three tips always beside the composer (messaging spec 2.3), and the way to the safety page. `id` names its
 * heading ("<id>-title"): each composer passes its own, so a kept page never repeats it (community actions plan
 * decision 2).
 */
export function SafetyTips({ id = "composer-tips" }: { id?: string }) {
  const titleId = `${id}-title`;
  return (
    <section aria-labelledby={titleId} className="msg-tips">
      <h2 id={titleId} className="msg-tips-title">
        Stay safe
      </h2>
      <ul>
        {SAFETY_TIPS.map((tip) => (
          <li key={tip}>{tip}</li>
        ))}
      </ul>
      <Link href="/safety" prefetch={false}>
        More safety tips
      </Link>
    </section>
  );
}
