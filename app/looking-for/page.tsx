import type { Metadata } from "next";
import { ComingSoon } from "@/components/ComingSoon";

export const metadata: Metadata = { title: "Looking For" };

export default function LookingForPage() {
  return <ComingSoon title="Looking For">Posting a request and getting offers from sellers arrives in the next stage.</ComingSoon>;
}
