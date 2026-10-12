import type { Metadata } from "next";
import { ComingSoon } from "@/components/ComingSoon";

export const metadata: Metadata = { title: "Saved" };

export default function SavedPage() {
  return (
    <ComingSoon title="Saved">
      The items you save are kept on this device. Seeing them all here arrives in the next stage.
    </ComingSoon>
  );
}
