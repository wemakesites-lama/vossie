import type { Metadata } from "next";
import { Reveal } from "@/components/kit/Reveal";
import { Onboarding } from "@/components/sell/Onboarding";
import { SellFormSkeleton } from "@/components/sell/SellSkeleton";
import { PageTransition } from "@/components/kit/PageTransition";

export const metadata: Metadata = { title: "Set up your shop", robots: { index: false } };

/**
 * The onboarding wizard (selling spec 2.6): the heading is prerendered; the step, which reads the link and the
 * session, streams in behind a skeleton (spec section 3).
 */
export default function OnboardingPage({ searchParams }: PageProps<"/sell/onboarding">) {
  return (
    <PageTransition>
      <div className="page sell-page">
        <div className="sell-column">
          <h1 className="sell-title">Set up your shop</h1>
          <Reveal fallback={<SellFormSkeleton />}>
            <Onboarding searchParams={searchParams} />
          </Reveal>
        </div>
      </div>
    </PageTransition>
  );
}
