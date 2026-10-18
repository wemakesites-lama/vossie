import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { addPin, featuredChoices, featuredFor, listPins } from "@/lib/data/featured";
import { resetSampleStore } from "@/lib/data/store";
import { AdminFeatured } from "./AdminFeatured";

vi.mock("@/lib/staff/admin-actions", () => ({ pinSeller: async () => {}, unpinSeller: async () => {} }));

const TODAY = "2026-10-14";
const NOW = new Date("2026-10-14T08:42:00.000Z");
const places = [
  { slug: "all", name: "No campus chosen" },
  { slug: "midrand", name: "Midrand" },
  { slug: "pretoria", name: "Pretoria" },
];

beforeEach(() => {
  resetSampleStore();
});

async function show(values: Record<string, string> = {}, errors: { message: string; fieldId: string }[] = []) {
  const rows = await Promise.all(places.map(async (campus) => ({ campus, sellers: await featuredFor(campus.slug, TODAY) })));
  render(
    <AdminFeatured
      today={TODAY}
      rows={rows}
      pins={await listPins(TODAY)}
      choices={await featuredChoices()}
      places={places}
      values={values}
      errors={errors}
    />,
  );
}

describe("Featured (staff tools spec 2.3 and 2.8)", () => {
  it("shows each campus's row today, pins marked", async () => {
    await addPin({ sellerSlug: "nail-bar", campusSlug: "pretoria", day: TODAY, staffId: "acc-admin", now: NOW });
    await show();
    const table = screen.getByRole("table", { name: "Featured today, by campus" });
    expect(within(table).getAllByRole("row")).toHaveLength(4);
    const pretoria = within(table).getByRole("cell", { name: "Pretoria" }).closest("tr") as HTMLElement;
    expect(within(pretoria).getAllByRole("cell")[1]).toHaveTextContent(/^FeaturedNail bar \(pinned\), /);
  });

  it("says what the draw does about the week's break: a preference, not a rule (amendment 15.2)", async () => {
    await show();
    expect(
      screen.getByText(
        /A seller who has been featured sits out for a week when there are enough other Verified sellers to fill the row\./,
      ),
    ).toBeInTheDocument();
    // The old line promised a strict break, which the draw doesn't keep (amendment 3).
    expect(screen.queryByText(/next six days/)).toBeNull();
  });

  it("offers the pin form: the sellers who can be featured, every place and today by default", async () => {
    await show();
    const sellers = screen.getByRole("combobox", { name: "Seller" });
    expect(within(sellers).getAllByRole("option")).toHaveLength(10);
    expect(within(screen.getByRole("combobox", { name: "Campus" })).getAllByRole("option").map((option) => option.textContent)).toEqual([
      "Choose a campus",
      "No campus chosen",
      "Midrand",
      "Pretoria",
    ]);
    const day = screen.getByLabelText("Day");
    expect(day).toHaveValue(TODAY);
    expect(day).toHaveAttribute("min", TODAY);
    expect(day).toHaveAttribute("max", "2026-12-13");
    expect(screen.getByRole("button", { name: "Pin the seller" })).toHaveAttribute("type", "submit");
  });

  it("lists the pins from today on, each with a Remove button naming it", async () => {
    await addPin({ sellerSlug: "nail-bar", campusSlug: "pretoria", day: TODAY, staffId: "acc-admin", now: NOW });
    await show();
    const pins = screen.getByRole("table", { name: "Pins from today on, soonest first" });
    expect(within(pins).getByRole("cell", { name: "Pieter" })).toBeInTheDocument();
    expect(within(pins).getByRole("button", { name: "Remove the pin for Nail bar at Pretoria on 14 Oct" })).toBeInTheDocument();
  });

  it("keeps what was chosen after a failed pin, with what's wrong", async () => {
    await show({ seller: "nail-bar", campus: "pretoria", day: "2026-10-13" }, [
      { message: "Choose today or a later date.", fieldId: "pin-day" },
    ]);
    expect(screen.getByRole("alert", { name: "There's a problem" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Seller" })).toHaveValue("nail-bar");
    expect(screen.getByLabelText("Day")).toHaveValue("2026-10-13");
    expect(screen.getByLabelText("Day")).toHaveAttribute("aria-invalid", "true");
  });
});
