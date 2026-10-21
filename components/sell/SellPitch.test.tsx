import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SellPitch } from "./SellPitch";

describe("the pitch (selling spec section 3)", () => {
  it("says why to sell here, the three steps and the fees, and links the seller guidelines", () => {
    render(<SellPitch startHref="/sell/onboarding" resuming={false} />);
    expect(screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent)).toEqual([
      "Why sell here",
      "Three steps",
      "Fees",
    ]);
    expect(screen.getByRole("region", { name: "Three steps" }).querySelectorAll("li")).toHaveLength(3);
    expect(screen.getByText(/CampusCart takes no cut/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "seller guidelines" })).toHaveAttribute("href", "/seller-guidelines");
  });
});
