import { render, screen, within } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { campuses } from "@/data/fixtures/campuses";
import { CampusSelect } from "./CampusSelect";
import { ErrorSummary } from "./ErrorSummary";
import { describedBy, FieldError } from "./FieldError";

const errors = [
  { message: "Use your Eduvos email address.", fieldId: "signin-email" },
  { message: "Too many tries. Start again.", fieldId: null },
];

describe("ErrorSummary (accounts spec 6)", () => {
  it("is nothing when nothing is wrong", () => {
    const { container } = render(<ErrorSummary errors={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("is an alert headed \"There's a problem\" that links each message to its field", () => {
    render(<ErrorSummary errors={errors} />);
    const summary = screen.getByRole("alert", { name: "There's a problem" });
    expect(within(summary).getByRole("link", { name: "Use your Eduvos email address." })).toHaveAttribute(
      "href",
      "#signin-email",
    );
    expect(within(summary).getByText("Too many tries. Start again.").tagName).toBe("LI");
    expect(summary).toHaveAttribute("tabindex", "-1");
  });

  it("asks the browser to focus it on a page load (plan decision 11)", () => {
    expect(renderToString(<ErrorSummary errors={errors} />)).toMatch(/<div[^>]*role="alert"[^>]*autofocus=""/);
  });
});

describe("FieldError (accounts spec 3.1)", () => {
  it("says it's an error, in words", () => {
    render(<FieldError id="signin-email-error" message="Use your Eduvos email address." />);
    expect(document.getElementById("signin-email-error")).toHaveTextContent("Error: Use your Eduvos email address.");
  });

  it("is nothing without a message, and describedBy joins only the ids it's given", () => {
    const { container } = render(<FieldError id="unused" message={undefined} />);
    expect(container).toBeEmptyDOMElement();
    expect(describedBy("hint", undefined, "", "error")).toBe("hint error");
    expect(describedBy(undefined, "")).toBeUndefined();
  });
});

describe("CampusSelect (accounts spec 3.1)", () => {
  it("lists every campus after \"Choose your campus\", starting on the one given", () => {
    render(
      <>
        <label htmlFor="campus">Your campus</label>
        <CampusSelect id="campus" defaultValue="pretoria" campuses={campuses} invalid={false} describedBy={undefined} />
      </>,
    );
    const select = screen.getByRole("combobox", { name: "Your campus" });
    expect(select).toHaveAttribute("name", "campus");
    expect(select).toHaveValue("pretoria");
    expect(within(select).getAllByRole("option").map((option) => option.textContent)).toEqual([
      "Choose your campus",
      ...campuses.map((campus) => campus.name),
    ]);
  });
});
