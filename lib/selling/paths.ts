import type { ListingsTab, ListingState } from "@/lib/types";

// Selling's addresses (selling spec section 3). The wizard's step and My listings' tab are in the link, which holds
// no personal data (spec 2.2).

export const SELL_PATH = "/sell";
export const PROFILE_PATH = "/sell/profile";
export const NEW_LISTING_PATH = "/sell/listings/new";

/** The wizard's five steps (selling spec 2.6), with the names its progress line uses. */
export const ONBOARDING_STEPS = [
  { step: 1, name: "Basics" },
  { step: 2, name: "About" },
  { step: 3, name: "Photo" },
  { step: 4, name: "Campus and pickup points" },
  { step: 5, name: "Review" },
] as const;

export type OnboardingStep = (typeof ONBOARDING_STEPS)[number]["step"];

export function onboardingPath(step: OnboardingStep): string {
  return step === 1 ? "/sell/onboarding" : `/sell/onboarding?step=${step}`;
}

/** `?step=` as a step, 1 to 5. Anything else is step 1. */
export function parseStep(raw: string | string[] | undefined): OnboardingStep {
  const step = Number(Array.isArray(raw) ? raw[0] : raw);
  return step === 2 || step === 3 || step === 4 || step === 5 ? step : 1;
}

/** My listings' tabs (selling spec 2.9), in order, with the state each shows. */
export const LISTINGS_TABS: ReadonlyArray<{ tab: ListingsTab; label: string; state: ListingState }> = [
  { tab: "available", label: "Available", state: "available" },
  { tab: "paused", label: "Paused", state: "paused" },
  { tab: "sold", label: "Sold", state: "sold" },
  { tab: "drafts", label: "Drafts", state: "draft" },
];

export function parseListingsTab(raw: string | string[] | undefined): ListingsTab {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return LISTINGS_TABS.find((item) => item.tab === value)?.tab ?? "available";
}

export function tabFor(state: ListingState): ListingsTab {
  return LISTINGS_TABS.find((item) => item.state === state)!.tab;
}

export function myListingsPath(tab: ListingsTab = "available"): string {
  return tab === "available" ? "/sell/listings" : `/sell/listings?tab=${tab}`;
}

export function editListingPath(id: string): string {
  return `/sell/listings/${id}/edit`;
}

export function deleteListingPath(id: string): string {
  return `/sell/listings/${id}/delete`;
}
