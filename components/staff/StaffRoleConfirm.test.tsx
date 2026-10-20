import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { StaffAccount } from "@/lib/data/staff-accounts";
import { removalLines, roleConfirmTitle, StaffRoleConfirm } from "./StaffRoleConfirm";

vi.mock("@/lib/staff/account-actions", () => ({ giveStaffRole: async () => {}, removeStaffRole: async () => {} }));

const naledi: StaffAccount = {
  id: "acc-mentor",
  firstName: "Naledi",
  email: "mentor@eduvos.com",
  campusSlug: "midrand",
  roles: ["mentor"],
  mentors: ["Plug & play", "Tech corner"],
};

describe("taking a role away (stage J spec decisions 4 and 5)", () => {
  it("says what removing a mentor role does, names the shops, and has no reason field", () => {
    render(<StaffRoleConfirm person={naledi} role="mentor" viewerId="acc-admin" errors={[]} />);
    expect(screen.getByText("Remove Naledi's mentor role?")).toBeInTheDocument();
    expect(screen.getAllByRole("listitem").map((item) => item.textContent)).toEqual([
      "Naledi loses the Hub's tools and the mentor dashboard straight away.",
      "These shops will have no mentor: Plug & play, Tech corner. Give them a new one on each shop's page.",
      "Naledi's notes, check-ins and Hub posts stay. Only an admin can edit those posts afterwards.",
    ]);
    expect(screen.queryByLabelText("Reason")).toBeNull();
    expect(screen.getByRole("button", { name: "Remove Naledi's mentor role" })).toHaveClass("btn-danger");
    expect(document.querySelector('input[name="account"]')).toHaveValue("acc-mentor");
    expect(document.querySelector('input[name="role"]')).toHaveValue("mentor");
    expect(screen.getByRole("link", { name: "Keep it" })).toHaveAttribute("href", "/admin/staff");
  });

  it("says a mentor with no shops mentors none, and that an admin keeps the tools (plan decision 10)", () => {
    expect(removalLines({ ...naledi, mentors: [] }, "mentor")[1]).toBe("Naledi mentors no shops.");
    expect(removalLines({ ...naledi, roles: ["mentor", "admin"] }, "mentor")[0]).toBe(
      "Naledi stays an admin, so keeps the Hub's tools and the mentor dashboard.",
    );
  });

  it("says what removing another admin's role does", () => {
    const sam: StaffAccount = { ...naledi, id: "acc-sam", firstName: "Sam", roles: ["admin"], mentors: [] };
    render(<StaffRoleConfirm person={sam} role="admin" viewerId="acc-admin" errors={[]} />);
    expect(screen.getAllByRole("listitem").map((item) => item.textContent)).toEqual([
      "Sam loses the admin console straight away.",
      "Sam's entries in the audit log stay.",
    ]);
    expect(screen.getByRole("button", { name: "Remove Sam's admin role" })).toBeInTheDocument();
  });

  it("refuses your own admin role, with no button and a way back", () => {
    const pieter: StaffAccount = { ...naledi, id: "acc-admin", firstName: "Pieter", roles: ["admin"], mentors: [] };
    render(<StaffRoleConfirm person={pieter} role="admin" viewerId="acc-admin" errors={[]} />);
    expect(screen.getByText("You can't remove your own admin role. Ask another admin.")).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByRole("link", { name: "Back to staff accounts" })).toHaveAttribute("href", "/admin/staff");
  });

  it("shows a refusal from the last post at the top", () => {
    const sam: StaffAccount = { ...naledi, id: "acc-sam", firstName: "Sam", roles: ["admin"], mentors: [] };
    render(
      <StaffRoleConfirm
        person={sam}
        role="admin"
        viewerId="acc-admin"
        errors={[{ message: "Vossie needs at least one admin.", fieldId: null }]}
      />,
    );
    expect(screen.getByRole("alert", { name: "There's a problem" })).toHaveTextContent("Vossie needs at least one admin.");
  });

  it("titles the page Your admin role only for your own, otherwise Remove {name}'s role", () => {
    const pieter: StaffAccount = { ...naledi, id: "acc-admin", firstName: "Pieter", roles: ["admin"], mentors: [] };
    expect(roleConfirmTitle(pieter, "admin", "acc-admin")).toBe("Your admin role");
    expect(roleConfirmTitle(pieter, "admin", "acc-other")).toBe("Remove Pieter's admin role");
    expect(roleConfirmTitle(naledi, "mentor", "acc-mentor")).toBe("Remove Naledi's mentor role");
  });
});
