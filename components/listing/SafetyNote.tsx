import Link from "next/link";
import { ShieldIcon } from "@/components/icons";

/** The safety note (spec 5.1). */
export function SafetyNote() {
  return (
    <aside aria-label="Safety" className="safety-note">
      <ShieldIcon className="safety-icon size-5" />
      <p>
        Meet at the pickup point, check it before you pay, and never pay a deposit.{" "}
        <Link href="/safety">Safety tips</Link>
      </p>
    </aside>
  );
}
