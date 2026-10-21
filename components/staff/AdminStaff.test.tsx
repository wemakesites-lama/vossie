import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { StaffAccount } from "@/lib/data/staff-accounts";
import { AdminStaff, mentoredText } from "./AdminStaff";

// The form only needs something to post to; the actions have their own tests.
vi.mock("@/lib/staff/account-actions", () => ({ giveStaffRole: async () => {}, removeStaffRole: async () => {} }));

const naledi: StaffAccount = {
  id: "acc-mentor",
  firstName: "Naledi",
  email: "mentor@eduvos.com",
  campusSlug: "midrand",
  roles: ["mentor"],
  mentors: ["Tech corner"],
};
const pieter: StaffAccount = {
  id: "acc-admin",
  firstName: "Pieter",
  email: "admin@eduvos.com",
  campusSlug: "pretoria",
  roles: ["admin"],
  mentors: [],
};
const campusNames = new Map([
  ["midrand", "Midrand"],
  ["pretoria", "Pretoria"],
]);
const TOKEN = "6f1c2a3e-8c1b-4d6e-9a43-0f6f1b3a9e55";

function view(overrides: Partial<Parameters<typeof AdminStaff>[0]> = {}) {
  return render(
    <AdminStaff
      people={[naledi, pieter]}
      viewerId="acc-admin"
      ownShopMentorId={null}
      campusNames={campusNames}
      values={{}}
      errors={[]}
      once={TOKEN}
      {...overrides}
    />,
  );
}

describe("Staff accounts (stage J spec decision 2)", () => {
  it("lists everyone with a role in a captioned table: name, email, campus, roles, shops and one action cell", () => {
    view();
    const table = screen.getByRole("table", { name: "Staff accounts (2)" });
    expect(within(table).getAllByRole("columnheader").map((cell) => cell.textContent)).toEqual([
      "Name",
      "Email",
      "Campus",
      "Roles",
      "Shops they mentor",
      "Change",
    ]);
    const [, first, second] = within(table).getAllByRole("row");
    expect(within(first).getAllByRole("cell").slice(0, 5).map((cell) => cell.textContent)).toEqual([
      "NameNaledi",
      "Emailmentor@eduvos.com",
      "CampusMidrand",
      "RolesMentor",
      "Shops they mentor1",
    ]);
    expect(within(second).getAllByRole("cell")[4]).toHaveTextContent("None");
  });

  it("gives each role its own Remove link, naming the person after the visible words", () => {
    view({ people: [{ ...naledi, roles: ["mentor", "admin"] }, pieter] });
    const row = screen.getAllByRole("row")[1];
    expect(within(row).getByRole("link", { name: "Remove mentor role for Naledi" })).toHaveAttribute(
      "href",
      "/admin/staff/acc-mentor/remove-mentor",
    );
    expect(within(row).getByRole("link", { name: "Remove admin role for Naledi" })).toHaveAttribute(
      "href",
      "/admin/staff/acc-mentor/remove-admin",
    );
    // The visible words come first (WCAG 2.5.3); the name is for screen readers.
    expect(within(row).getAllByText("for Naledi")[0]).toHaveClass("sr-only");
  });

  it("says This is you. on the admin's own admin role, with no link to remove it (spec decision 5)", () => {
    view();
    const own = screen.getAllByRole("row")[2];
    expect(within(own).queryByRole("link")).toBeNull();
    expect(within(own).getByText("This is you.")).toBeInTheDocument();
  });

  it("says Mentors your shop. on the mentor role of whoever mentors the viewer's shop, with no link (stage M spec decision 6)", () => {
    const sipho: StaffAccount = {
      id: "acc-seller",
      firstName: "Sipho",
      email: "seller@eduvos.com",
      campusSlug: "midrand",
      roles: ["admin"],
      mentors: [],
    };
    view({
      people: [{ ...naledi, roles: ["mentor", "admin"] }, pieter, sipho],
      viewerId: "acc-seller",
      ownShopMentorId: "acc-mentor",
    });
    const [, nalediRow, pieterRow, siphoRow] = screen.getAllByRole("row");
    expect(within(nalediRow).getByText("Mentors your shop.")).toHaveClass("staff-muted");
    expect(within(nalediRow).queryByRole("link", { name: "Remove mentor role for Naledi" })).toBeNull();
    // Her admin role is another matter (decision 3).
    expect(within(nalediRow).getByRole("link", { name: "Remove admin role for Naledi" })).toBeInTheDocument();
    expect(within(pieterRow).getByRole("link", { name: "Remove admin role for Pieter" })).toBeInTheDocument();
    expect(within(siphoRow).getByText("This is you.")).toBeInTheDocument();
  });

  it("offers every Remove link when nobody mentors the viewer's shop", () => {
    view();
    expect(screen.getByRole("link", { name: "Remove mentor role for Naledi" })).toBeInTheDocument();
    expect(screen.queryByText("Mentors your shop.")).toBeNull();
  });

  it("counts the shops a mentor mentors, and says None for an admin who isn't one (plan decision 11)", () => {
    expect(mentoredText({ roles: ["mentor"], mentors: [] })).toBe("0");
    expect(mentoredText({ roles: ["mentor", "admin"], mentors: ["A", "B"] })).toBe("2");
    expect(mentoredText({ roles: ["admin"], mentors: [] })).toBe("None");
  });
});

describe("Give a staff role (stage J spec decision 3)", () => {
  it("asks for the exact email and one of two roles, with a one-time token, and searches nothing", () => {
    view();
    const section = screen.getByRole("region", { name: "Give a staff role" });
    const email = within(section).getByLabelText("Eduvos email");
    expect(email).toHaveAttribute("type", "email");
    expect(email).toHaveAttribute("autocomplete", "off");
    expect(email).toHaveAccessibleDescription(
      "The email they sign in with. They need to have signed in to Vossie once.",
    );
    const group = within(section).getByRole("group", { name: "Role" });
    expect(within(group).getByRole("radio", { name: "Mentor" })).toHaveAccessibleDescription(
      "The Hub's posts and office hours, and the mentor dashboard",
    );
    expect(within(group).getByRole("radio", { name: "Admin" })).toHaveAccessibleDescription("Everything, including this page");
    expect(section.querySelector('input[name="once"]')).toHaveValue(TOKEN);
    expect(within(section).getByRole("button", { name: "Give role" })).toHaveAttribute("type", "submit");
    expect(within(section).queryByRole("combobox")).toBeNull();
    expect(within(section).queryByRole("listbox")).toBeNull();
  });

  it("keeps the typed email and the chosen role with what's wrong", () => {
    view({
      values: { email: "nobody@eduvos.com", role: "admin" },
      errors: [
        {
          message: "No Vossie account uses that email. Ask them to sign in once, then try again.",
          fieldId: "give-role-email",
        },
      ],
    });
    expect(screen.getByRole("alert", { name: "There's a problem" })).toHaveAttribute("id", "give-role-problems");
    const email = screen.getByLabelText("Eduvos email");
    expect(email).toHaveValue("nobody@eduvos.com");
    expect(email).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("radio", { name: "Admin" })).toBeChecked();
  });
});
