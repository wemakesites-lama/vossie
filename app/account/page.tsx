import type { Metadata } from "next";
import { ComingSoon } from "@/components/ComingSoon";

export const metadata: Metadata = { title: "Your account" };

export default function AccountPage() {
  return <ComingSoon title="Your account">Your profile, listings and messages arrive in the next stage.</ComingSoon>;
}
