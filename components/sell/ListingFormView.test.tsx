import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { categories } from "@/data/fixtures/categories";
import { pickupPoints } from "@/data/fixtures/pickup-points";
import { ListingFormView } from "./ListingFormView";

vi.mock("@/lib/selling/listing-actions", () => ({ saveListingForm: async () => {} }));

const spots = pickupPoints.filter((point) => point.campusSlug === "midrand");
const values = { kind: "item", payMode: "cash", handover: "pickup", pickup: "pp-midrand-library" };

const view = (overrides: Partial<Parameters<typeof ListingFormView>[0]> = {}) => (
  <ListingFormView
    listingId={null}
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
const show = (overrides: Partial<Parameters<typeof ListingFormView>[0]> = {}) => render(view(overrides));

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

  it("keeps a photo's description after a failed save, when React resets the form", async () => {
    const user = userEvent.setup();
    const photo = { src: "/placeholders/photo/2.svg", alt: "", thumb: "/placeholders/photo/2.svg" };
    const { rerender } = show({ listingId: "l-001", photos: [photo] });
    await user.type(screen.getByRole("textbox", { name: "Describe photo 1" }), "The back");
    // The save fails: the server sends back what was typed, and React then resets the form to its default values.
    rerender(
      view({
        listingId: "l-001",
        values: { ...values, title: "" },
        photos: [{ ...photo, alt: "The back" }],
        errors: [{ message: "Give your listing a title.", fieldId: "edit-l-001-title" }],
        round: "2026-10-15T10:10:00.000Z",
      }),
    );
    screen.getByRole("button", { name: "Save and publish" }).closest("form")!.reset();
    expect(screen.getByRole("textbox", { name: "Describe photo 1" })).toHaveValue("The back");
  });

  it("starts the photo field again after every post, so photos the server refused don't linger", () => {
    const photo = { src: "/placeholders/photo/2.svg", alt: "", thumb: "/placeholders/photo/2.svg" };
    const { rerender } = show({ photos: [photo], round: "2026-10-15T10:10:00.000Z" });
    const before = screen.getByRole("textbox", { name: "Describe photo 1" });
    rerender(view({ photos: [photo], round: "2026-10-15T10:11:00.000Z" }));
    expect(screen.getByRole("textbox", { name: "Describe photo 1" })).not.toBe(before);
  });
});
