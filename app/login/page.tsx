import type { Metadata } from "next";
import { ComingSoon } from "@/components/ComingSoon";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return <ComingSoon title="Sign in">Signing in with your email arrives in the next stage.</ComingSoon>;
}
