import type { Metadata } from "next";
import { ComingSoon } from "@/components/ComingSoon";

export const metadata: Metadata = { title: "Safety" };

export default function SafetyPage() {
  return (
    <ComingSoon title="Safety">
      Until the full guide arrives: meet at an approved campus pickup point, check the item before you pay, and never
      pay a deposit to someone you haven&apos;t met.
    </ComingSoon>
  );
}
