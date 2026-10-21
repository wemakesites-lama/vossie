import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { HowItWorks } from "./HowItWorks";

describe("HowItWorks (spec 7.9)", () => {
  it("explains buying and selling in three steps each, with a button for each", () => {
    render(<HowItWorks />);
    expect(screen.getByRole("region", { name: "Safe, simple, on campus" })).toBeInTheDocument();
    for (const [title, action, href] of [
      ["Buying", "Start shopping", "/browse"],
      ["Selling", "Start selling", "/sell"],
    ]) {
      const card = screen.getByRole("heading", { level: 3, name: title }).parentElement!;
      expect(within(card).getAllByRole("listitem")).toHaveLength(3);
      expect(within(card).getByRole("link", { name: action })).toHaveAttribute("href", href);
    }
  });

  it("ends with the safety rules", () => {
    render(<HowItWorks />);
    const rules = screen.getByRole("list", { name: "How CampusCart keeps you safe" });
    expect(within(rules).getAllByRole("listitem").map((item) => item.textContent)).toEqual([
      "Verified sellers",
      "Approved pickup points",
      "Never pay before you see it",
    ]);
  });
});
