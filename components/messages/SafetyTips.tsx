import Link from "next/link";
import { SAFETY_TIPS } from "@/lib/messaging/scam-check";

/** The three tips always beside the composer (messaging spec 2.3), and the way to the safety page. */
export function SafetyTips() {
  return (
    <section aria-labelledby="composer-tips-title" className="msg-tips">
      <h2 id="composer-tips-title" className="msg-tips-title">
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
