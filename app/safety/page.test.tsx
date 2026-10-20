import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import SafetyPage, { metadata } from "./page";

describe("Safety (info and system spec 3)", () => {
  it("is titled and described for search results and link previews", () => {
    expect(metadata.title).toBe("Safety");
    expect(metadata.description).toMatch(/never paying in advance/i);
  });

  it("has one h1 and five sections", () => {
    render(<SafetyPage />);
    expect(screen.getByRole("heading", { level: 1, name: "Safety" })).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent)).toEqual([
      "Meeting safely",
      "Checking before you pay",
      "Paying safely",
      "Signs of a scam",
      "Reporting a problem",
    ]);
  });

  it("tells people to meet at pickup points, in daylight, with a friend", () => {
    render(<SafetyPage />);
    const meeting = screen.getByRole("region", { name: "Meeting safely" });
    expect(within(meeting).getByText(/approved pickup point on campus/)).toBeInTheDocument();
    expect(within(meeting).getByText(/Go in daylight/)).toBeInTheDocument();
    expect(within(meeting).getByText(/Take a friend/)).toBeInTheDocument();
  });

  it("says never to pay in advance and never to share bank details or codes", () => {
    render(<SafetyPage />);
    const paying = screen.getByRole("region", { name: "Paying safely" });
    expect(within(paying).getByText(/Never pay a deposit or pay in advance/)).toBeInTheDocument();
    expect(within(paying).getByText(/Never share your bank card details, PIN, passwords or one-time codes/)).toBeInTheDocument();
  });

  it("lists the signs of a scam", () => {
    render(<SafetyPage />);
    const scams = screen.getByRole("region", { name: "Signs of a scam" });
    expect(within(scams).getAllByRole("listitem")).toHaveLength(6);
    expect(within(scams).getByText(/asks you to pay first/)).toBeInTheDocument();
    expect(within(scams).getByText(/screenshot as proof that they've paid/)).toBeInTheDocument();
  });

  it("says how to report, gives the police number, and links to the trust page and the Hub", () => {
    render(<SafetyPage />);
    const reporting = screen.getByRole("region", { name: "Reporting a problem" });
    expect(within(reporting).getByText(/Every listing, every seller's page and every Looking For request has a Report link/)).toBeInTheDocument();
    expect(within(reporting).getByText(/can hide a listing or a request, or pause an account/)).toBeInTheDocument();
    expect(within(reporting).queryByText(/can hide a listing or pause an account\./)).toBeNull();
    expect(within(reporting).getByText(/10111/)).toBeInTheDocument();
    expect(within(reporting).getByRole("link", { name: "how trust works" })).toHaveAttribute("href", "/trust");
    expect(within(reporting).getByRole("link", { name: "Incubation Hub" })).toHaveAttribute("href", "/hub");
  });

  it("is not a draft", () => {
    render(<SafetyPage />);
    expect(screen.queryByRole("note")).toBeNull();
  });
});
