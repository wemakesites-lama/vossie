import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { categories } from "@/data/fixtures/categories";
import { pickupPoints } from "@/data/fixtures/pickup-points";
import { ListingFormView } from "./ListingFormView";

vi.mock("@/lib/selling/listing-actions", () => ({ saveListingForm: async () => {} }));
// next/link draws a plain <a> in jsdom and keeps `prefetch` to itself, so this one shows it as data.
vi.mock("next/link", async () => {
  const { createElement } = await import("react");
  return {
    default: ({
      href,
      prefetch,
      children,
      ...rest
    }: {
      href: string;
      prefetch?: boolean | null;
      children?: React.ReactNode;
      className?: string;
    }) =>
      createElement(
        "a",
        { href, "data-prefetch": prefetch === undefined ? "auto" : String(prefetch), ...rest },
        children,
      ),
  };
});

const spots = pickupPoints.filter((point) => point.campusSlug === "midrand");
const values = { kind: "item", payMode: "cash", handover: "pickup", pickup: "pp-midrand-library" };

type Props = Parameters<typeof ListingFormView>[0];

const view = (overrides: Partial<Props> = {}) => (
  <ListingFormView
    listingId={null}
    once={null}
    state={null}
    waiting={false}
    values={values}
    photos={[]}
    errors={[]}
    categories={categories}
    spots={spots}
    campusName="Midrand"
    {...overrides}
  />
);

const show = (overrides: Partial<Props> = {}) => render(view(overrides));

describe("the listing form (selling spec 2.10, plan decision 26)", () => {
  it("asks for every field of the listing model, with Save and publish as the button Enter presses", () => {
    show();
    expect(screen.getByRole("group", { name: "What are you listing?" })).toBeInTheDocument();
    for (const label of ["Title", "Category", "Condition (items only)", "Price in rand", "What would you swap for?", "Description", "Pickup point"]) {
      expect(screen.getByLabelText(label), label).toBeInTheDocument();
    }
    expect(screen.getByRole("checkbox", { name: "It's free" })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "This is a starting price (services)" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "How do you want to be paid?" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "How does it change hands?" })).toHaveAccessibleDescription(
      "At Midrand, your shop's campus.",
    );
    expect(screen.getByLabelText("Add photos")).toHaveAttribute("type", "file");
    const form = screen.getByRole("button", { name: "Save and publish" }).closest("form")!;
    expect(form.querySelector('button[type="submit"]')).toHaveAttribute("value", "publish");
    expect(screen.getByRole("button", { name: "Save as draft" })).toHaveAttribute("value", "draft");
  });

  it("says Save changes on a paused or sold listing, and carries the listing's id", () => {
    show({ listingId: "l-001", state: "paused" });
    expect(screen.getByRole("button", { name: "Save changes" })).toBeInTheDocument();
    expect(document.querySelector('input[name="listing"]')).toHaveValue("l-001");
    expect(screen.getByLabelText("Title")).toHaveAttribute("id", "edit-l-001-title");
  });

  it("carries a new listing's one-time token as a hidden field, and an edit carries none (amendment 14.1)", () => {
    const { unmount } = show({ once: "11111111-1111-4111-8111-111111111111" });
    const hidden = document.querySelector<HTMLInputElement>('input[name="once"]');
    expect(hidden).toHaveAttribute("type", "hidden");
    expect(hidden).toHaveValue("11111111-1111-4111-8111-111111111111");
    expect(document.querySelector('input[name="listing"]')).toBeNull();
    unmount();
    // Saving the same listing twice changes nothing, so an edit has no use for one.
    show({ listingId: "l-001", once: "11111111-1111-4111-8111-111111111111" });
    expect(document.querySelector('input[name="once"]')).toBeNull();
  });

  it("draws no token field when it has no token", () => {
    show({ once: null });
    expect(document.querySelector('input[name="once"]')).toBeNull();
  });

  it("offers a shop waiting for approval drafts only (plan decision 4)", () => {
    show({ waiting: true });
    expect(screen.queryByRole("button", { name: "Save and publish" })).toBeNull();
    expect(screen.getByRole("button", { name: "Save as draft" })).toBeInTheDocument();
    expect(screen.getByText(/Your shop is waiting for the Hub/)).toBeInTheDocument();
  });

  it("shows the errors, linked to their fields, and keeps what was typed", () => {
    show({
      values: { ...values, title: "", price: "lots" },
      errors: [
        { message: "Give your listing a title.", fieldId: "new-title" },
        { message: "Enter the price in whole rand, like 250.", fieldId: "new-price" },
      ],
    });
    expect(screen.getByRole("alert", { name: "There's a problem" })).toBeInTheDocument();
    expect(screen.getByLabelText("Price in rand")).toHaveValue("lots");
    expect(screen.getByLabelText("Price in rand")).toHaveAttribute("aria-invalid", "true");
  });

  it("offers a shop without pickup spots no pickup", () => {
    show({ spots: [], campusName: "Eduvos Online", values: { kind: "service", payMode: "cash", handover: "online" } });
    expect(screen.queryByRole("radio", { name: "Pickup at one of your points" })).toBeNull();
    expect(screen.queryByLabelText("Pickup point")).toBeNull();
  });

  it("never prefetches (amendment 4)", () => {
    const { container } = show({ listingId: "l-001", state: "available" });
    const links = [...container.querySelectorAll<HTMLAnchorElement>("a:not([href^='#'])")];
    expect(links.length).toBeGreaterThan(0);
    expect(links.filter((link) => link.dataset.prefetch !== "false")).toEqual([]);
  });

  it("keys the form by its listing, so a kept form carries nothing into another listing's (amendment 2)", async () => {
    const user = userEvent.setup();
    const one = { ...values, title: "Desk fan" };
    const { rerender } = render(view({ listingId: "l-001", state: "available", values: one }));
    const first = document.querySelector("form")!;
    await user.type(screen.getByLabelText("Title"), " typed but not sent");
    rerender(view({ listingId: "l-007", state: "available", values: { ...values, title: "Kettle" } }));
    expect(document.querySelector("form")).not.toBe(first);
    expect(screen.getByLabelText("Title")).toHaveValue("Kettle");
    rerender(view({ listingId: "l-001", state: "available", values: one }));
    expect(screen.getByLabelText("Title")).toHaveValue("Desk fan");
  });
});

// Amendment 3. Next keeps the last pages hidden in the DOM, so two edit forms (for two listings) can be there at once.
// A <label for>, an error summary's "#field" link and an aria-describedby all go to the *first* element with that id,
// which may sit on the hidden page. So every id starts with the form's prefix ("edit-<id>"), and each reference must
// find an element inside its own form.

/** Every id a view's labels, error-summary links, aria-describedby and aria-labelledby point to. */
function referencesIn(view: HTMLElement): string[] {
  return [
    ...[...view.querySelectorAll("label[for]")].map((label) => `label for #${label.getAttribute("for")}`),
    ...[...view.querySelectorAll('a[href^="#"]')].map((link) => `link #${link.getAttribute("href")!.slice(1)}`),
    ...[...view.querySelectorAll("[aria-describedby], [aria-labelledby]")].flatMap((element) =>
      `${element.getAttribute("aria-describedby") ?? ""} ${element.getAttribute("aria-labelledby") ?? ""}`
        .split(/\s+/)
        .filter(Boolean)
        .map((id) => `aria #${id}`),
    ),
  ];
}

/** The references that find nothing, or find an element outside the view (what the browser finds is the first match). */
function strays(view: HTMLElement): string[] {
  return referencesIn(view).filter((reference) => {
    const found = document.getElementById(reference.slice(reference.indexOf("#") + 1));
    return !found || !view.contains(found);
  });
}

/** Every field fails at once, so each error and its link are there to be followed. */
const everyError = (prefix: string) =>
  ["kind", "title", "category", "condition", "price", "pay", "swap", "description", "handover", "pickup", "photos"].map(
    (field) => ({ message: `Fix the ${field}.`, fieldId: `${prefix}-${field}` }),
  );

const photos = [
  { src: "/placeholders/listing/tech.svg", alt: "", thumb: "/placeholders/listing/tech.svg" },
  { src: "/placeholders/photo/2.svg", alt: "The back", thumb: "/placeholders/photo/2.svg" },
];

describe("the listing form's ids (amendment 3)", () => {
  it("starts every id with its listing, so two kept edit forms never share one", () => {
    const views = ["l-001", "l-007"].map(
      (id) =>
        render(view({ listingId: id, state: "available", values, photos, errors: everyError(`edit-${id}`) })).container,
    );
    const ids = [...document.querySelectorAll("[id]")].map((element) => element.id);
    expect(ids.filter((id, index) => ids.indexOf(id) !== index)).toEqual([]);
    for (const container of views) {
      expect(strays(container)).toEqual([]);
      // Not a pass for want of anything to check: the errors, the photo rows and their hints are all there.
      expect(container.querySelectorAll('a[href^="#"]')).toHaveLength(11);
      expect(container.querySelectorAll('input[name="photo"]')).toHaveLength(2);
      expect(container.querySelectorAll("[aria-describedby]").length).toBeGreaterThanOrEqual(13);
    }
    expect(screen.getAllByRole("alert", { name: "There's a problem" }).map((summary) => summary.id)).toEqual([
      "edit-l-001-summary",
      "edit-l-007-summary",
    ]);
  });
});
