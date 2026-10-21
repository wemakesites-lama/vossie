import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ConfirmAction } from "./ConfirmAction";
import { StaffFrame } from "./StaffFrame";
import { StaffSkeleton } from "./StaffSkeleton";
import { StaffTable } from "./StaffTable";

const noop = async () => {};

describe("the staff frame (staff tools spec section 3)", () => {
  it("has the page's heading, the sections the account may use, and the open one marked", () => {
    render(
      <StaffFrame account={{ roles: ["mentor"] }} area="Hub tools" title="Hub posts" current="/hub/manage" notice={null}>
        <p>The page</p>
      </StaffFrame>,
    );
    // A title with one long word (a request's or a listing's) wraps instead of pushing the page sideways on a phone.
    expect(screen.getByRole("heading", { level: 1, name: "Hub posts" })).toHaveClass("wrap-anywhere");
    const nav = screen.getByRole("navigation", { name: "Staff tools" });
    expect(within(nav).getAllByRole("link").map((link) => [link.textContent, link.getAttribute("href")])).toEqual([
      ["Hub posts", "/hub/manage"],
      ["Mentoring", "/mentor"],
    ]);
    expect(within(nav).getByRole("link", { name: "Hub posts" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByText("The page")).toBeInTheDocument();
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("gives an admin every section, and shows the last action's notice as a status line (spec 4)", () => {
    render(
      <StaffFrame account={{ roles: ["admin"] }} area="Admin console" title="Sellers" current="/admin/sellers" notice="Approved.">
        <p>The page</p>
      </StaffFrame>,
    );
    expect(within(screen.getByRole("navigation", { name: "Staff tools" })).getAllByRole("link")).toHaveLength(10);
    expect(screen.getByRole("status")).toHaveTextContent("Approved.");
  });

  it("is a wordless skeleton in the static shell, saying nothing about the page (plan decision 1)", () => {
    const { container } = render(<StaffSkeleton />);
    expect(container.textContent).toBe("");
    expect(container.firstElementChild).toHaveAttribute("aria-hidden", "true");
  });
});

describe("staff tables (staff tools spec 2.9 and 4, plan decision 20)", () => {
  it("has a caption and header cells, keeps its roles, and labels each cell for phones, hidden from screen readers", () => {
    render(
      <StaffTable
        caption="Waiting for approval"
        columns={["Shop", "Campus"]}
        rows={[{ key: "tech-corner", cells: ["Tech corner", "Midrand"] }]}
        empty="Nobody is waiting."
      />,
    );
    const table = screen.getByRole("table", { name: "Waiting for approval" });
    expect(within(table).getAllByRole("columnheader").map((cell) => cell.textContent)).toEqual(["Shop", "Campus"]);
    const cell = within(table).getAllByRole("cell")[1];
    expect(cell).toHaveTextContent("CampusMidrand");
    expect(within(cell).getByText("Campus")).toHaveAttribute("aria-hidden", "true");
    expect(within(table).getByRole("cell", { name: "Midrand" })).toBe(cell);
  });

  it("says so when there's nothing to list", () => {
    render(<StaffTable caption="Waiting" columns={["Shop"]} rows={[]} empty="Nobody is waiting." />);
    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.getByText("Nobody is waiting.")).toBeInTheDocument();
  });

  it("can make each row's first cell its header, with scope row and no phone label (stage J spec section 7)", () => {
    render(
      <StaffTable
        caption="All campuses, by week"
        columns={["Measure", "Last week"]}
        rows={[{ key: "listings", cells: ["Listings published", "12"] }]}
        empty=""
        rowHeader
      />,
    );
    const table = screen.getByRole("table", { name: "All campuses, by week" });
    const header = within(table).getByRole("rowheader", { name: "Listings published" });
    expect(header.tagName).toBe("TH");
    expect(header).toHaveAttribute("scope", "row");
    expect(header.querySelector(".staff-cell-label")).toBeNull();
    expect(within(table).getByRole("cell", { name: "12" })).toHaveTextContent("Last week12");
  });
});

describe("confirm pages (staff tools spec 2.9 and 4, plan decision 18)", () => {
  const props = {
    id: "decline-crochet-corner",
    lead: "Crochet corner won't be approved yet.",
    consequences: ["Lerato sees your reason on their selling page.", "They can change the shop and send it again."],
    action: noop,
    hidden: { shop: "crochet-corner" },
    reasonHint: "The seller sees it.",
    reason: "",
    errors: [],
    confirmLabel: "Decline Crochet corner",
    keepHref: "/admin/sellers/crochet-corner",
  };

  it("repeats what will happen, asks for the reason, and names its button; Keep it goes back", () => {
    render(<ConfirmAction {...props} />);
    expect(screen.getByText("Crochet corner won't be approved yet.")).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    const reason = screen.getByLabelText("Reason");
    expect(reason).toBeRequired();
    expect(reason).toHaveAccessibleDescription("The seller sees it. Up to 500 characters.");
    expect(screen.getByRole("button", { name: "Decline Crochet corner" })).toHaveAttribute("type", "submit");
    expect(screen.getByRole("link", { name: "Keep it" })).toHaveAttribute("href", "/admin/sellers/crochet-corner");
    expect(document.querySelector('input[name="shop"]')).toHaveValue("crochet-corner");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("shows what was typed, and what's wrong, at the top and by the field", () => {
    const message = "Keep the reason to 500 characters.";
    render(
      <ConfirmAction {...props} reason={"x".repeat(501)} errors={[{ message, fieldId: "decline-crochet-corner-reason" }]} />,
    );
    expect(screen.getByRole("alert", { name: "There's a problem" })).toHaveTextContent(message);
    const reason = screen.getByLabelText("Reason");
    expect(reason).toHaveAttribute("aria-invalid", "true");
    expect(reason).toHaveValue("x".repeat(501));
    expect(reason).toHaveAccessibleDescription(`The seller sees it. Up to 500 characters. Error: ${message}`);
  });

  it("has no reason field in its no-reason mode, and still says what's wrong (stage J spec decision 4)", () => {
    const { rerender } = render(
      <ConfirmAction
        id="remove-mentor-acc-mentor"
        lead="Remove Naledi's mentor role?"
        consequences={["Naledi mentors no shops."]}
        action={noop}
        hidden={{ account: "acc-mentor", role: "mentor" }}
        reason={false}
        errors={[]}
        confirmLabel="Remove Naledi's mentor role"
        keepHref="/admin/staff"
      />,
    );
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.queryByLabelText("Reason")).toBeNull();
    expect(screen.getByRole("button", { name: "Remove Naledi's mentor role" })).toHaveAttribute("type", "submit");
    expect(document.querySelector('input[name="role"]')).toHaveValue("mentor");
    expect(screen.getByRole("link", { name: "Keep it" })).toHaveAttribute("href", "/admin/staff");
    rerender(
      <ConfirmAction
        id="remove-admin-acc-other"
        lead="Remove Sam's admin role?"
        consequences={[]}
        action={noop}
        hidden={{ account: "acc-other", role: "admin" }}
        reason={false}
        errors={[{ message: "CampusCart needs at least one admin.", fieldId: null }]}
        confirmLabel="Remove Sam's admin role"
        keepHref="/admin/staff"
      />,
    );
    expect(screen.getByRole("alert", { name: "There's a problem" })).toHaveTextContent("CampusCart needs at least one admin.");
  });
});
