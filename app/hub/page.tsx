import type { Metadata } from "next";
import { ComingSoon } from "@/components/ComingSoon";

export const metadata: Metadata = { title: "The Incubation Hub" };

export default function HubPage() {
  return (
    <ComingSoon title="The Incubation Hub">
      The Hub&apos;s story, verified sellers and events arrive in the next stage.
    </ComingSoon>
  );
}
