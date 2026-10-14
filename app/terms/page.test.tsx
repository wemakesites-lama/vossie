import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import TermsPage, { metadata } from "./page";

describe("Terms of use (info and system spec 2.1 and 3)", () => {
  it("is titled and described for search results and link previews", () => {
    expect(metadata.title).toBe("Terms of use");
    expect(metadata.description).toMatch(/rules for using Vossie/);
  });

  it("is kept out of search results until Eduvos signs it off (controller amendment 1)", () => {
    expect(metadata.robots).toEqual({ index: false });
  });

  it("has one h1 and seven sections", () => {
    render(<TermsPage />);
    expect(screen.getByRole("heading", { level: 1, name: "Terms of use" })).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent)).toEqual([
      "Who can use Vossie",
      "Vossie is not part of your deal",
      "What you can't do",
      "What you post",
      "Moderation and suspension",
      "Our responsibility",
      "Changes and the law",
    ]);
  });

  it("is a draft, in words", () => {
    render(<TermsPage />);
    expect(screen.getByRole("note")).toHaveTextContent("Draft for Eduvos to review. Not yet in force.");
  });

  it("says Vossie is not a party to a sale and holds no money or goods", () => {
    render(<TermsPage />);
    const deal = screen.getByRole("region", { name: "Vossie is not part of your deal" });
    expect(within(deal).getByText(/Vossie is not the buyer or the seller, does not hold anyone's money or goods/)).toBeInTheDocument();
    expect(within(deal).getByRole("link", { name: "safety guide" })).toHaveAttribute("href", "/safety");
  });

  it("points to the seller guidelines for what can't be sold", () => {
    render(<TermsPage />);
    const prohibited = screen.getByRole("region", { name: "What you can't do" });
    expect(within(prohibited).getByRole("link", { name: "seller guidelines" })).toHaveAttribute(
      "href",
      "/seller-guidelines",
    );
  });

  it("covers content, moderation, liability and changes", () => {
    render(<TermsPage />);
    expect(screen.getByText(/Do not post photos of other people without their consent/)).toBeInTheDocument();
    expect(screen.getByText(/can hide a listing, remove content, or pause or close an account/)).toBeInTheDocument();
    expect(screen.getByText(/Eduvos is not responsible for losses from deals between users/)).toBeInTheDocument();
    expect(screen.getByText(/These terms follow South African law/)).toBeInTheDocument();
  });
});
