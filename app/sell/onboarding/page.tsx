import type { Metadata } from "next";
import { Suspense } from "react";
import { Onboarding } from "@/components/sell/Onboarding";
import { SellFormSkeleton } from "@/components/sell/SellSkeleton";
import { ONBOARDING_STEPS, parseStep } from "@/lib/selling/paths";

/**
 * Each step has its own tab title ("Step 2 of 5: About · Set up your shop · Vossie"), so a screen reader hears the
 * step change when the app moves to it (Next announces a new title), and a page load says where you are.
 */
export async function generateMetadata({ searchParams }: PageProps<"/sell/onboarding">): Promise<Metadata> {
  const step = parseStep((await searchParams).step);
  const title = `Step ${step} of 5: ${ONBOARDING_STEPS[step - 1].name} · Set up your shop`;
  return { title, robots: { index: false } };
}

/**
 * The onboarding wizard (selling spec 2.6): the heading is prerendered; the step, which reads the link and the
 * session, streams in behind a skeleton (spec section 3).
 */
export default function OnboardingPage({ searchParams }: PageProps<"/sell/onboarding">) {
  return (
    <div className="page sell-page">
      <div className="sell-column">
        <h1 className="sell-title">Set up your shop</h1>
        <Suspense fallback={<SellFormSkeleton />}>
          <Onboarding searchParams={searchParams} />
        </Suspense>
      </div>
    </div>
  );
}
