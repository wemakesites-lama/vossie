import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { formatRand } from "@/lib/format";
import { PLUS_PRICE_ZAR, PLUS_YEAR_ZAR, STARTER_LISTINGS } from "@/lib/plans/plans";
import PlansPage from "./page";

describe("the Plans page (decision 100)", () => {
  it("shows the two plans with the numbers from lib/plans", () => {
    render(<PlansPage />);
    expect(screen.getByRole("heading", { level: 1, name: "Plans for shops" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Starter: free" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: `Plus: ${formatRand(PLUS_PRICE_ZAR)} a month` })).toBeInTheDocument();
    expect(screen.getByText(`Up to ${STARTER_LISTINGS} listings live at once.`)).toBeInTheDocument();
    expect(screen.getByText(new RegExp(`A year of Plus is ${formatRand(PLUS_YEAR_ZAR)},`))).toBeInTheDocument();
  });

  it("takes no payment: it says so, and has nothing to press or fill in", () => {
    const { container } = render(<PlansPage />);
    expect(screen.getByText(/CampusCart takes no payments of any kind today\./)).toBeInTheDocument();
    expect(container.querySelectorAll("form, button, input, select, textarea")).toHaveLength(0);
  });
});
