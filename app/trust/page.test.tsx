import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import TrustPage, { metadata } from "./page";

/** The paragraph under a heading. */
function paragraphUnder(heading: HTMLElement): string {
  return heading.nextElementSibling?.textContent ?? "";
}

describe("How trust works (info and system spec 2.3, 2.4 and 3)", () => {
  it("is titled and described for search results and link previews", () => {
    expect(metadata.title).toBe("How trust works");
    expect(metadata.description).toMatch(/Verified sellers/);
    expect(metadata.description).toMatch(/what happens after a report/);
  });

  it("has one h1 and five sections", () => {
    render(<TrustPage />);
    expect(screen.getByRole("heading", { level: 1, name: "How trust works" })).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent)).toEqual([
      "Verified by the Hub",
      "The three badges",
      "What counts",
      "When something is reported",
      "How Featured today is picked",
    ]);
  });

  it("says what the Hub does with a report, Show again included (stage K spec 6)", () => {
    render(<TrustPage />);
    const reports = screen.getByRole("region", { name: "When something is reported" });
    expect(within(reports).getByText(/report a listing, a shop or a Looking For request/)).toBeInTheDocument();
    expect(within(reports).getByText(/never names them to the seller/)).toBeInTheDocument();
    expect(within(reports).getByText(/it can show it again/)).toBeInTheDocument();
    expect(within(reports).getByText(/only a Hub admin can give someone that role/)).toBeInTheDocument();
  });

  it("explains Verified as a badge the Hub gives after checking, separate from approval, and not a promise (selling spec 8.10)", () => {
    render(<TrustPage />);
    const verified = screen.getByRole("region", { name: "Verified by the Hub" });
    expect(
      within(verified).getByText(/is a badge the Eduvos Incubation Hub gives a seller after checking who they are/),
    ).toBeInTheDocument();
    expect(
      within(verified).getByText(/separate from approval: the Hub approves every shop before it can sell/),
    ).toBeInTheDocument();
    expect(within(verified).getByText(/only some approved shops are Verified/)).toBeInTheDocument();
    expect(verified).not.toHaveTextContent("approved their shop");
    expect(within(verified).getByText(/isn't a promise that a deal will go well/)).toBeInTheDocument();
    expect(within(verified).getByRole("link", { name: "safety steps" })).toHaveAttribute("href", "/safety");
  });

  it("gives the three badges and their rules (spec 2.4)", () => {
    render(<TrustPage />);
    const badges = screen.getByRole("region", { name: "The three badges" });
    const names = within(badges).getAllByRole("heading", { level: 3 });
    expect(names.map((heading) => heading.textContent)).toEqual(["New seller", "Responsive", "Trusted"]);
    expect(paragraphUnder(names[0])).toMatch(/^Everyone starts here\./);
    expect(paragraphUnder(names[1])).toBe(
      "In the last 90 days the seller has had at least 3 enquiries and replied to at least 80% of them within 48 hours.",
    );
    expect(paragraphUnder(names[2])).toBe(
      "In the last 90 days the seller has had at least 3 enquiries and replied to at least 85% of them within 48 hours. " +
        "They also have at least 5 sales or swaps that buyers have confirmed, and their account is at least 30 days old.",
    );
  });

  it("says badges are worked out from conversations, sample shops keep sample badges, and a badge can go down (staff tools spec 2.7)", () => {
    render(<TrustPage />);
    const badges = screen.getByRole("region", { name: "The three badges" });
    expect(
      within(badges).getByText(/gets its badge worked out by the rules below, from its conversations on CampusCart/),
    ).toBeInTheDocument();
    expect(
      within(badges).getByText(/most shops are samples with no account behind them, and they show sample badges/),
    ).toBeInTheDocument();
    expect(badges).not.toHaveTextContent("once accounts are live");
    expect(badges).not.toHaveTextContent("badges you see on sellers today are samples");
    expect(within(badges).getByText(/a badge can go down again/)).toBeInTheDocument();
  });

  it("has no Top Hustler badge, which this build doesn't have", () => {
    const { container } = render(<TrustPage />);
    expect(container).not.toHaveTextContent("Top Hustler");
  });

  it("says what counts and what doesn't (plan decision 16)", () => {
    render(<TrustPage />);
    const counts = screen.getByRole("region", { name: "What counts" });
    const items = within(counts)
      .getAllByRole("listitem")
      .map((item) => item.textContent);
    expect(items).toHaveLength(4);
    expect(items[1]).toMatch(/still inside its 48 hours doesn't count against the seller/);
    expect(items[2]).toMatch(/a week after the seller marks it completed/);
    expect(items[2]).toMatch(/says it didn't happen, it doesn't count/);
    expect(items[3]).toMatch(/outside CampusCart, such as on WhatsApp/);
  });

  it("explains how Featured today is picked", () => {
    render(<TrustPage />);
    const featured = screen.getByRole("region", { name: "How Featured today is picked" });
    const items = within(featured)
      .getAllByRole("listitem")
      .map((item) => item.textContent);
    expect(items).toHaveLength(5);
    expect(items[0]).toMatch(/Only Verified sellers with an open shop and something listed/);
    expect(items[1]).toMatch(/fair draw/);
    expect(items[2]).toMatch(/its sellers come first/);
    expect(items[3]).toMatch(/sits out for a week/);
    expect(items[4]).toMatch(/Hub staff can pin a Verified seller/);
    expect(within(featured).getByText(/Each campus gets its own draw every day/)).toBeInTheDocument();
    expect(featured).not.toHaveTextContent("Once accounts are live");
  });

  it("says the week's break is a preference, and who comes back first when it gives (amendment 3, stage M spec decision 12)", () => {
    render(<TrustPage />);
    const featured = screen.getByRole("region", { name: "How Featured today is picked" });
    const items = within(featured)
      .getAllByRole("listitem")
      .map((item) => item.textContent);
    expect(items[3]).toBe(
      "A seller who has been featured sits out for a week when there are enough other Verified sellers to fill the row. When there aren't, the sellers featured longest ago come back first.",
    );
  });

  it("is not a draft", () => {
    render(<TrustPage />);
    expect(screen.queryByRole("note")).toBeNull();
  });
});
