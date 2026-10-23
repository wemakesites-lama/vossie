import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { campuses } from "@/data/fixtures/campuses";
import type { FormStateRow } from "@/lib/data/rows";
import type { Account } from "@/lib/types";
import { DetailsView, detailsForm } from "./DetailsView";

// The form only needs something to post to; the action has its own tests.
vi.mock("@/lib/auth/actions", () => ({ updateDetails: async () => {} }));

const account: Account = {
  id: "acc-student",
  email: "student@eduvos.com",
  firstName: "Thandi",
  campusSlug: "midrand",
  roles: [],
  seller: null,
  createdAt: "2026-09-01T07:30:00.000Z",
};

const state = (fields: Partial<FormStateRow>): FormStateRow => ({
  key: "session-key:details",
  sessionKey: "session-key",
  form: "details",
  errors: [],
  values: {},
  notice: null,
  expiresAt: "2099-01-01T00:00:00.000Z",
  ...fields,
});

function renderDetails(who: Account = account, formState: FormStateRow | null = null) {
  return render(<DetailsView account={who} campuses={campuses} details={detailsForm(who, formState)} />);
}

describe("Your details (accounts spec 3.2; role views spec 7.4)", () => {
  it("shows the first name, the email, the campus and when they joined", () => {
    renderDetails();
    expect(screen.getByRole("heading", { level: 2, name: "Thandi" })).toBeInTheDocument();
    expect(screen.getByText("Email").nextElementSibling).toHaveTextContent("student@eduvos.com");
    expect(screen.getByText("Campus").nextElementSibling).toHaveTextContent("Midrand");
    expect(screen.getByText("Member since September 2026")).toBeInTheDocument();
    expect(screen.queryByText("Hub role")).toBeNull();
  });

  it("starts Edit details on the account's details", () => {
    renderDetails();
    const edit = screen.getByRole("region", { name: "Edit details" });
    expect(within(edit).getByLabelText("Your first name")).toHaveValue("Thandi");
    expect(within(edit).getByRole("combobox", { name: "Your campus" })).toHaveValue("midrand");
    expect(within(edit).getByRole("button", { name: "Save changes" })).toHaveAttribute("type", "submit");
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("says when the details were saved (plan decision 13)", () => {
    renderDetails(account, state({ notice: "saved" }));
    expect(screen.getByRole("status")).toHaveTextContent("Your details are saved.");
  });

  it("shows what was typed and what's wrong after a failed save", () => {
    renderDetails(account, state({ errors: ["first-name-length", "campus-missing"], values: { firstName: "T", campus: "" } }));
    expect(screen.getByRole("alert", { name: "There's a problem" })).toBeInTheDocument();
    const name = screen.getByLabelText("Your first name");
    expect(name).toHaveValue("T");
    expect(name).toHaveAccessibleDescription(
      "Sellers see it when you message them. 2 to 40 characters. Error: Your first name must be 2 to 40 characters.",
    );
    expect(screen.getByRole("combobox", { name: "Your campus" })).toHaveValue("");
  });

  it("names a mentor's or an admin's Hub role (plan decision 16)", () => {
    renderDetails({ ...account, roles: ["admin"] });
    expect(screen.getByText("Hub role").nextElementSibling).toHaveTextContent("Admin");
  });
});
