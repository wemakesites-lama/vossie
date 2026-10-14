import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { campuses } from "@/data/fixtures/campuses";
import { categories } from "@/data/fixtures/categories";
import { pickupPoints } from "@/data/fixtures/pickup-points";
import type { FormError } from "@/lib/auth/messages";
import type { OnboardingDraftRow } from "@/lib/data/rows";
import type { OnboardingStep } from "@/lib/selling/paths";
import { OnboardingView } from "./OnboardingView";

// The forms only need something to post to; the actions have their own tests.
vi.mock("@/lib/selling/shop-actions", () => ({ saveOnboardingStep: async () => {}, sendForApproval: async () => {} }));
// next/link draws a plain <a> in jsdom and keeps `prefetch` and `replace` to itself, so this one shows them as data.
vi.mock("next/link", async () => {
  const { createElement } = await import("react");
  return {
    default: ({
      href,
      prefetch,
      replace,
      children,
      ...rest
    }: {
      href: string;
      prefetch?: boolean | null;
      replace?: boolean;
      children?: React.ReactNode;
      className?: string;
    }) =>
      createElement(
        "a",
        { href, "data-prefetch": prefetch === undefined ? "auto" : String(prefetch), "data-replace": String(Boolean(replace)), ...rest },
        children,
      ),
  };
});

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

const view = (step: OnboardingStep, overrides: Partial<OnboardingDraftRow> = {}, errors: FormError[] = []) => (
  <OnboardingView
    step={step}
    draft={{ ...draft, ...overrides }}
    errors={errors}
    campuses={campuses}
    categories={categories}
    pickupPoints={pickupPoints}
  />
);

const show = (step: OnboardingStep, overrides: Partial<OnboardingDraftRow> = {}, errors: FormError[] = []) =>
  render(view(step, overrides, errors));

/** One error for every field a step has, for the tests that check what the errors link to. */
const ERRORS: Record<OnboardingStep, FormError[]> = {
  1: [
    { message: "Name.", fieldId: "onb-name" },
    { message: "Tagline.", fieldId: "onb-tagline" },
    { message: "Category.", fieldId: "onb-category" },
  ],
  2: [{ message: "About.", fieldId: "onb-about" }],
  3: [{ message: "Photo.", fieldId: "onb-photo" }],
  4: [
    { message: "Campus.", fieldId: "onb-campus" },
    { message: "Points.", fieldId: "onb-points" },
  ],
  5: [
    { message: "Guidelines.", fieldId: "onb-guidelines" },
    { message: "Not sent.", fieldId: null },
  ],
};

const STEPS = [1, 2, 3, 4, 5] as const;

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
    show(1, { name: "Z" }, [{ message: "Your shop's name must be 2 to 60 characters.", fieldId: "onb-name" }]);
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

describe("the wizard's forms (selling plan amendments 1 to 4, and 9.3)", () => {
  it("gives each step's error summary its own id", () => {
    for (const step of STEPS) {
      const { unmount } = show(step, {}, ERRORS[step]);
      const summary = screen.getByRole("alert", { name: "There's a problem" });
      expect(summary).toHaveAttribute("id", `onb-step-${step}-summary`);
      unmount();
    }
  });

  it("shows step 5's unlinked error, from Send for approval, as plain text", () => {
    show(5, {}, [{ message: "Something went wrong, so your application wasn't sent. Try again.", fieldId: null }]);
    const summary = screen.getByRole("alert", { name: "There's a problem" });
    expect(summary).toHaveTextContent("Something went wrong, so your application wasn't sent. Try again.");
    expect(within(summary).queryByRole("link")).toBeNull();
    expect(screen.getByRole("checkbox", { name: "I've read the seller guidelines" })).not.toHaveAttribute("aria-invalid");
  });

  it("links the guidelines error to the box and joins it to the box", () => {
    show(5, {}, [{ message: "Tick the box to say you've read the seller guidelines.", fieldId: "onb-guidelines" }]);
    const box = screen.getByRole("checkbox", { name: "I've read the seller guidelines" });
    expect(box).toHaveAttribute("aria-invalid", "true");
    expect(box).toHaveAccessibleDescription("Error: Tick the box to say you've read the seller guidelines.");
    expect(screen.getByRole("link", { name: "Tick the box to say you've read the seller guidelines." })).toHaveAttribute(
      "href",
      "#onb-guidelines",
    );
  });

  it("makes every id unique, and every label, link and description find its element, on every step", () => {
    for (const step of STEPS) {
      const { container, unmount } = show(step, { photoSrc: "/photos/ph-1" }, ERRORS[step]);
      const ids = [...container.querySelectorAll("[id]")].map((element) => element.id);
      expect(ids.filter((id, index) => ids.indexOf(id) !== index), `step ${step}`).toEqual([]);
      const used = [
        ...[...container.querySelectorAll("label[for]")].map((label) => label.getAttribute("for")!),
        ...[...container.querySelectorAll('a[href^="#"]')].map((link) => link.getAttribute("href")!.slice(1)),
        ...[...container.querySelectorAll("[aria-describedby], [aria-labelledby]")].flatMap((element) =>
          `${element.getAttribute("aria-describedby") ?? ""} ${element.getAttribute("aria-labelledby") ?? ""}`
            .split(" ")
            .filter(Boolean),
        ),
      ];
      expect(used.filter((id) => !ids.includes(id)), `step ${step}`).toEqual([]);
      unmount();
    }
  });

  it("keys each step's form, so a kept step carries nothing into the next", async () => {
    const user = userEvent.setup();
    const { rerender } = show(2);
    const first = document.querySelector("form")!;
    await user.type(screen.getByRole("textbox", { name: "About your shop" }), " Typed but not sent.");
    rerender(view(3));
    expect(document.querySelector("form")).not.toBe(first);
    rerender(view(2));
    expect(screen.getByRole("textbox", { name: "About your shop" })).toHaveValue("I bake between lectures.");
  });

  it("never prefetches, and Back and Change replace the history entry", () => {
    for (const step of STEPS) {
      const { container, unmount } = show(step);
      // Step 1 has no link at all; the others have at least Back.
      const links = [...container.querySelectorAll<HTMLAnchorElement>("a")];
      expect(links.length > 0, `step ${step}`).toBe(step !== 1);
      expect(
        links.filter((link) => link.dataset.prefetch !== "false"),
        `step ${step}`,
      ).toEqual([]);
      unmount();
    }
    show(5);
    const review = screen.getByRole("region", { name: "Your answers" });
    for (const link of within(review).getAllByRole("link")) expect(link).toHaveAttribute("data-replace", "true");
    expect(screen.getByRole("link", { name: "Back" })).toHaveAttribute("data-replace", "true");
  });
});
