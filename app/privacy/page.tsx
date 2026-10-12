import type { Metadata } from "next";
import { ComingSoon } from "@/components/ComingSoon";

export const metadata: Metadata = { title: "Privacy (POPIA)" };

export default function PrivacyPage() {
  return (
    <ComingSoon title="Privacy (POPIA)">
      <p>The full privacy notice arrives with accounts. For now Vossie keeps very little:</p>
      <ul className="mt-3 list-disc pl-5">
        <li>
          Your campus choice, in a cookie called <code>vossie_campus</code> that lasts a year. Your browser sends it
          back to Vossie so pages can show your campus first.
        </li>
        <li>
          Saved items, your list of recent searches and the data saver setting are kept only in your browser. When
          you search, the words you search for are sent to Vossie in the page address to find results.
        </li>
      </ul>
      <p className="mt-3">
        The campus updates form doesn&apos;t send or store your email yet. Clearing your browser data removes
        everything above.
      </p>
    </ComingSoon>
  );
}
