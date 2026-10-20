import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import HowItWorksPage, { metadata } from "./page";

describe("How it works (info and system spec 3)", () => {
  it("is titled and described for search results and link previews", () => {
    expect(metadata.title).toBe("How Vossie works");
    expect(metadata.description).toMatch(/find it, message the seller, meet on campus/i);
  });

  it("has one h1 and four sections", () => {
    render(<HowItWorksPage />);
    expect(screen.getByRole("heading", { level: 1, name: "How Vossie works" })).toBeInTheDocument();
    const names = screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent);
    expect(names).toEqual(["Buying", "Selling", "Trust, in one paragraph", "Questions and answers"]);
  });

  it("walks through buying: find it, message the seller, meet at a pickup point, pay or swap", () => {
    render(<HowItWorksPage />);
    const buying = screen.getByRole("region", { name: "Buying" });
    const steps = within(buying)
      .getAllByRole("listitem")
      .map((item) => item.querySelector("strong")?.textContent);
    expect(steps).toEqual(["Find it.", "Message the seller.", "Meet at a pickup point.", "See it, then pay or swap."]);
    expect(within(buying).getByText(/Vossie takes no online payments/)).toBeInTheDocument();
    expect(within(buying).getByRole("link", { name: "safety guide" })).toHaveAttribute("href", "/safety");
  });

  it("walks through selling: apply, the Hub checks you, list, reply within 48 hours", () => {
    render(<HowItWorksPage />);
    const selling = screen.getByRole("region", { name: "Selling" });
    const steps = within(selling)
      .getAllByRole("listitem")
      .map((item) => item.querySelector("strong")?.textContent);
    expect(steps).toEqual(["Apply.", "Get checked by the Hub.", "List what you have.", "Reply within 48 hours."]);
    expect(within(selling).getByRole("link", { name: "seller guidelines" })).toHaveAttribute(
      "href",
      "/seller-guidelines",
    );
  });

  it("explains trust in one paragraph that links to the trust page", () => {
    render(<HowItWorksPage />);
    const trust = screen.getByRole("region", { name: "Trust, in one paragraph" });
    expect(trust.querySelectorAll("p")).toHaveLength(1);
    expect(within(trust).getByRole("link", { name: "How trust works" })).toHaveAttribute("href", "/trust");
  });

  it("answers six short questions, including what works today", () => {
    render(<HowItWorksPage />);
    const questions = screen.getByRole("region", { name: "Questions and answers" });
    expect(within(questions).getAllByRole("heading", { level: 3 }).map((heading) => heading.textContent)).toEqual([
      "Who can use Vossie?",
      "Does it cost anything?",
      "How do I pay?",
      "Can I buy from another campus?",
      "How do I become a seller?",
      "What can I do on Vossie today?",
    ]);
    expect(within(questions).getByText(/Browse every campus, save listings on your device and share them/)).toBeInTheDocument();
    // Selling is open now (selling plan, Task 15): the answers say how to start, and that a preview forgets.
    expect(within(questions).getByText(/press Start selling on Sell, and answer five short questions/)).toBeInTheDocument();
    expect(within(questions).getByText(/set up a shop of your own/)).toBeInTheDocument();
    expect(within(questions).getByText(/can disappear when the server restarts/)).toBeInTheDocument();
    expect(within(questions).queryByText(/once selling opens|Selling arrives/)).toBeNull();
    // What stages H to J added (stage K spec 6).
    expect(within(questions).getByText(/Messaging, selling, reporting, posting a request, following a shop, saving a search/)).toBeInTheDocument();
    expect(within(questions).getByText(/save a search and hear when a new listing matches it/)).toBeInTheDocument();
    expect(within(questions).getByText(/Notifications show on Vossie only: nothing is emailed yet\./)).toBeInTheDocument();
    expect(within(questions).queryByText(/Messaging and selling need an account/)).toBeNull();
  });

  it("is not a draft", () => {
    render(<HowItWorksPage />);
    expect(screen.queryByRole("note")).toBeNull();
  });
});
