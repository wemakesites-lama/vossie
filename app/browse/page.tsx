import type { Metadata } from "next";
import { ComingSoon } from "@/components/ComingSoon";

export const metadata: Metadata = { title: "Browse" };

export default function BrowsePage() {
  return <ComingSoon title="Browse">Search results, filters and every listing arrive in the next stage.</ComingSoon>;
}
