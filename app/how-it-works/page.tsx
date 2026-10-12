import type { Metadata } from "next";
import { ComingSoon } from "@/components/ComingSoon";

export const metadata: Metadata = { title: "How Vossie works" };

export default function HowItWorksPage() {
  return <ComingSoon title="How Vossie works">Step-by-step guides for buying and selling arrive in the next stage.</ComingSoon>;
}
