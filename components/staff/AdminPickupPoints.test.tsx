import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { listPickupPoints, retirePickupPoint } from "@/lib/data/pickup-points";
import { resetSampleStore } from "@/lib/data/store";
import { AdminPickupPoints } from "./AdminPickupPoints";

vi.mock("@/lib/staff/admin-actions", () => ({
  addPoint: async () => {},
  renamePoint: async () => {},
  retirePoint: async () => {},
  restorePoint: async () => {},
}));

const campuses = [
  { slug: "midrand", name: "Midrand" },
  { slug: "online", name: "Eduvos Online" },
];

beforeEach(() => {
  resetSampleStore();
});

describe("pickup points (staff tools spec 2.3, plan decision 10)", () => {
  it("lists each campus's points, each with Rename and Retire naming it, and a form to add one", async () => {
    render(<AdminPickupPoints campuses={campuses} points={await listPickupPoints()} addForms={{}} renameForms={{}} />);
    const midrand = screen.getByRole("region", { name: "Midrand" });
    expect(midrand).toHaveAttribute("id", "points-midrand");
    expect(within(midrand).getByRole("textbox", { name: "New name for Library entrance at Midrand" })).toHaveValue(
      "Library entrance",
    );
    expect(within(midrand).getByRole("button", { name: "Rename Library entrance at Midrand" })).toBeInTheDocument();
    expect(within(midrand).getByRole("button", { name: "Retire Library entrance at Midrand" })).toBeInTheDocument();
    expect(within(midrand).getByRole("textbox", { name: "New pickup point at Midrand" })).toHaveValue("");
    expect(within(midrand).getByRole("button", { name: "Add to Midrand" })).toBeInTheDocument();
  });

  it("marks a retired point, offering Use it again instead", async () => {
    await retirePickupPoint("pp-midrand-library", new Date("2026-10-14T08:42:00.000Z"));
    render(<AdminPickupPoints campuses={campuses} points={await listPickupPoints()} addForms={{}} renameForms={{}} />);
    const midrand = screen.getByRole("region", { name: "Midrand" });
    expect(within(midrand).getByText(/Retired on 14 Oct/)).toBeInTheDocument();
    expect(within(midrand).getByRole("button", { name: "Use Library entrance at Midrand again" })).toBeInTheDocument();
    expect(within(midrand).queryByRole("button", { name: "Rename Library entrance at Midrand" })).toBeNull();
  });

  it("says Eduvos Online has none, with no form", async () => {
    render(<AdminPickupPoints campuses={campuses} points={await listPickupPoints()} addForms={{}} renameForms={{}} />);
    const online = screen.getByRole("region", { name: "Eduvos Online" });
    expect(online).toHaveTextContent("Eduvos Online has no pickup points: everything there happens online.");
    expect(within(online).queryByRole("button")).toBeNull();
  });

  it("shows a failed add's name and what's wrong, at its campus", async () => {
    const message = "That campus already has a pickup point with that name.";
    render(
      <AdminPickupPoints
        campuses={campuses}
        points={await listPickupPoints()}
        addForms={{ midrand: { name: "library ENTRANCE", errors: [{ message, fieldId: "point-add-midrand-name" }] } }}
        renameForms={{}}
      />,
    );
    const midrand = screen.getByRole("region", { name: "Midrand" });
    expect(within(midrand).getByRole("alert", { name: "There's a problem" })).toHaveTextContent(message);
    const field = within(midrand).getByRole("textbox", { name: "New pickup point at Midrand" });
    expect(field).toHaveValue("library ENTRANCE");
    expect(field).toHaveAttribute("aria-invalid", "true");
  });
});
