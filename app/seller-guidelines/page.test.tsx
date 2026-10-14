import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import SellerGuidelinesPage, { metadata } from "./page";

describe("Seller guidelines (info and system spec 2.1 and 3)", () => {
  it("is titled and described for search results and link previews", () => {
    expect(metadata.title).toBe("Seller guidelines");
    expect(metadata.description).toMatch(/what can't be sold/);
  });

  it("is kept out of search results until Eduvos signs it off (controller amendment 1)", () => {
    expect(metadata.robots).toEqual({ index: false });
  });

  it("has one h1 and seven sections", () => {
    render(<SellerGuidelinesPage />);
    expect(screen.getByRole("heading", { level: 1, name: "Seller guidelines" })).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent)).toEqual([
      "Who can sell",
      "What can't be sold",
      "Honest listings and photos",
      "Prices and swaps",
      "Replying within 48 hours",
      "Meeting buyers",
      "After a report",
    ]);
  });

  it("is a draft, in words", () => {
    render(<SellerGuidelinesPage />);
    expect(screen.getByRole("note")).toHaveTextContent("Draft for Eduvos to review. Not yet in force.");
  });

  it("lists what can't be sold: weapons, alcohol and tobacco to under-18s, medicines, counterfeits, cheating", () => {
    render(<SellerGuidelinesPage />);
    const banned = screen.getByRole("region", { name: "What can't be sold" });
    const items = within(banned)
      .getAllByRole("listitem")
      .map((item) => item.textContent ?? "");
    expect(items).toHaveLength(7);
    expect(items[0]).toMatch(/^weapons/);
    expect(items[1]).toMatch(/^alcohol or tobacco sold to anyone under 18/);
    expect(items[2]).toMatch(/^medicines/);
    expect(items[3]).toMatch(/^counterfeit goods/);
    expect(items[4]).toMatch(/^academic dishonesty/);
    expect(items[4]).toMatch(/Tutoring and study notes are welcome/);
  });

  it("asks for a reply within 48 hours and links to the trust page", () => {
    render(<SellerGuidelinesPage />);
    const reply = screen.getByRole("region", { name: "Replying within 48 hours" });
    expect(within(reply).getByText(/Reply to every enquiry within 48 hours/)).toBeInTheDocument();
    expect(within(reply).getByRole("link", { name: "How trust works" })).toHaveAttribute("href", "/trust");
  });

  it("says to meet at pickup points and links to the safety guide", () => {
    render(<SellerGuidelinesPage />);
    const meeting = screen.getByRole("region", { name: "Meeting buyers" });
    expect(within(meeting).getByText(/approved pickup point on campus, in daylight/)).toBeInTheDocument();
    expect(within(meeting).getByRole("link", { name: "safety guide" })).toHaveAttribute("href", "/safety");
  });

  it("says what happens after a report, and that you can ask for a second look", () => {
    render(<SellerGuidelinesPage />);
    const reports = screen.getByRole("region", { name: "After a report" });
    expect(within(reports).getByText(/A member of the Hub team reads every report/)).toBeInTheDocument();
    expect(within(reports).getByText(/contact the Hub and we will look again/)).toBeInTheDocument();
  });
});
