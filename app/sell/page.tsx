import type { Metadata } from "next";
import { ComingSoon } from "@/components/ComingSoon";

export const metadata: Metadata = { title: "Start selling" };

export default function SellPage() {
  return <ComingSoon title="Start selling">Listing an item, a service or a swap arrives in the next stage.</ComingSoon>;
}
