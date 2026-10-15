import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { campuses } from "@/data/fixtures/campuses";
import { categories } from "@/data/fixtures/categories";
import { pickupPoints } from "@/data/fixtures/pickup-points";
import type { OnboardingDraftRow } from "@/lib/data/rows";
import { OnboardingView } from "./OnboardingView";

// The forms only need something to post to; the actions have their own tests.
vi.mock("@/lib/selling/shop-actions", () => ({ saveOnboardingStep: async () => {}, sendForApproval: async () => {} }));

const draft: OnboardingDraftRow = {
  accountId: "acc-student",
  name: "Zola's Bakes",
  tagline: "",
  categorySlug: "food",
  about: "I bake between lectures.",
  photoSrc: null,
  campusSlug: "midrand",
  pickupPointIds: ["pp-midrand-library"],
  updatedAt: "2026-10-14T08:00:00.000Z",
};

const show = (step: 1 | 2 | 3 | 4 | 5, overrides: Partial<OnboardingDraftRow> = {}, errors = [] as never[]) =>
  render(
    <OnboardingView
      step={step}
      draft={{ ...draft, ...overrides }}
      errors={errors}
      campuses={campuses}
      categories={categories}
      pickupPoints={pickupPoints}
    />,
  );

describe("the wizard (selling spec 2.6, plan decision 15)", () => {
  it("says which step it is in words, and fills step 1 from the draft", () => {
    show(1);
    expect(screen.getByText("Step 1 of 5: Basics")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Shop name" })).toHaveValue("Zola's Bakes");
    expect(screen.getByRole("combobox", { name: "Main category" })).toHaveValue("food");
    expect(screen.getByRole("button", { name: "Continue" })).toHaveAttribute("type", "submit");
    expect(screen.queryByRole("link", { name: "Back" })).toBeNull();
  });

  it("shows the errors, linked to their fields", () => {
    show(1, { name: "Z" }, [{ message: "Your shop's name must be 2 to 60 characters.", fieldId: "onb-name" }] as never[]);
    expect(screen.getByRole("alert", { name: "There's a problem" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Shop name" })).toHaveAttribute("aria-invalid", "true");
  });

  it("offers a photo, or the category's picture, and a way back", () => {
    const { unmount } = show(3);
    expect(screen.getByText("Step 3 of 5: Photo")).toBeInTheDocument();
    expect(screen.getByLabelText("Shop photo (optional)")).toHaveAttribute("type", "file");
    expect(screen.queryByRole("button", { name: "Remove photo" })).toBeNull();
    expect(screen.getByRole("link", { name: "Back" })).toHaveAttribute("href", "/sell/onboarding?step=2");
    unmount();
    show(3, { photoSrc: "/photos/ph-1" });
    expect(screen.getByRole("button", { name: "Remove photo" })).toHaveAttribute("value", "remove");
  });

  it("lists the pickup spots of the campus it shows, and says when there are none", () => {
    const { unmount } = show(4);
    const spots = screen.getByRole("group", { name: "Pickup points at Midrand" });
    expect(within(spots).getByRole("checkbox", { name: "Library entrance" })).toBeChecked();
    expect(within(spots).getByRole("checkbox", { name: "Main reception" })).not.toBeChecked();
    expect(document.querySelector('input[name="pointsCampus"]')).toHaveValue("midrand");
    unmount();
    show(4, { campusSlug: "online", pickupPointIds: [] });
    expect(screen.getByText(/Eduvos Online has no pickup points/)).toBeInTheDocument();
  });

  it("reviews every answer with a way to change it, then asks for the guidelines box", () => {
    show(5);
    const review = screen.getByRole("region", { name: "Your answers" });
    expect(within(review).getByText("Zola's Bakes")).toBeInTheDocument();
    expect(within(review).getByRole("link", { name: "Change shop name" })).toHaveAttribute("href", "/sell/onboarding");
    expect(within(review).getByRole("link", { name: "Change pickup points" })).toHaveAttribute(
      "href",
      "/sell/onboarding?step=4",
    );
    expect(screen.getByRole("checkbox", { name: "I've read the seller guidelines" })).toBeRequired();
    expect(screen.getByRole("button", { name: "Send for approval" })).toHaveAttribute("type", "submit");
  });
});
