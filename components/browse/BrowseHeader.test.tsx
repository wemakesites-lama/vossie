import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { makeBrowseQuery } from "@/tests/helpers/fakes";
import { BrowseHeader } from "./BrowseHeader";

describe("BrowseHeader (spec 4.1, 4.2)", () => {
  it("says Shop and Everything with nothing chosen", () => {
    render(<BrowseHeader query={makeBrowseQuery()} categoryName={null} />);
    expect(screen.getByRole("heading", { level: 1, name: "Everything" })).toBeInTheDocument();
    expect(screen.getByText("Shop")).toHaveClass("eyebrow");
  });

  it("quotes the search, says where it's searching, and fills the field", () => {
    render(<BrowseHeader query={makeBrowseQuery({ q: "calculator", sort: "match" })} categoryName="Tech" />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("“calculator”");
    expect(screen.getByText("Search in Tech")).toBeInTheDocument();
    expect(screen.getByRole("searchbox", { name: "Search CampusCart" })).toHaveValue("calculator");
  });

  it("searches with a plain form that keeps the category and filters, and the campus only from the link", () => {
    const { container } = render(
      <BrowseHeader
        query={makeBrowseQuery({ category: "tech", campus: "midrand", campusFromLink: false, price: "free" })}
        categoryName="Tech"
      />,
    );
    const form = screen.getByRole("search");
    expect(form).toHaveAttribute("action", "/browse");
    const hidden = Object.fromEntries(
      [...container.querySelectorAll<HTMLInputElement>("input[type=hidden]")].map((input) => [input.name, input.value]),
    );
    expect(hidden).toEqual({ cat: "tech", price: "free" });
    expect(screen.getByRole("button", { name: "Search" })).toHaveAttribute("type", "submit");
  });
});
