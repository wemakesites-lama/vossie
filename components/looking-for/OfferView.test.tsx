import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { requests } from "@/data/fixtures/requests";
import type { OfferStatus } from "@/lib/looking-for/subjects";
import { OfferView, offerForm } from "./OfferView";

vi.mock("@/lib/looking-for/actions", () => ({ sendOffer: async () => {} }));

const SUBJECT = { request: requests[0], campusName: "Midrand" };
const OPEN: OfferStatus = {
  kind: "open",
  askerId: "acc-student",
  shopSlug: "tech-corner",
  listings: [{ id: "l-001", title: "Casio fx-991ZA Plus calculator" }],
};
const EMPTY = offerForm(null, "offer-r-001");

describe("the offer composer (community actions spec 2.9)", () => {
  it("shows the request, Offer to help, the offer field, the listings to point to, and E's tips", () => {
    render(<OfferView subject={SUBJECT} status={OPEN} form={EMPTY} />);
    expect(screen.getByRole("heading", { level: 1, name: "Offer to help" })).toBeInTheDocument();
    expect(screen.getByText("Accounting 1 tutor this week", { selector: ".offer-summary-title" })).toBeInTheDocument();
    expect(screen.getByText("Budget R300")).toBeInTheDocument();
    expect(screen.getByText(/Needed by/)).toHaveTextContent("Needed by 16 Oct");
    expect(screen.getByLabelText("Your offer")).toHaveAccessibleDescription(
      "Up to 1,000 characters. Say how you can help, what it costs and when.",
    );
    const select = screen.getByLabelText("Point to one of your listings (optional)");
    expect(within(select).getAllByRole("option").map((option) => option.textContent)).toEqual([
      "None",
      "Casio fx-991ZA Plus calculator",
    ]);
    expect(screen.getByRole("button", { name: "Send offer" })).toHaveAttribute("type", "submit");
    expect(document.querySelector('input[name="request"]')).toHaveValue("r-001");
    expect(screen.getByRole("region", { name: "Stay safe" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to Accounting 1 tutor this week" })).toHaveAttribute("href", "/looking-for/r-001");
  });

  it("leaves the select out when the shop has nothing listed", () => {
    render(<OfferView subject={SUBJECT} status={{ ...OPEN, listings: [] }} form={EMPTY} />);
    expect(screen.queryByLabelText("Point to one of your listings (optional)")).toBeNull();
  });

  it("says why anyone else can't offer, with the way on (plan decision 12)", () => {
    const cases: Array<[OfferStatus, string, string | null]> = [
      [{ kind: "no-shop" }, "Offers come from shops on CampusCart, so the Hub has checked who's offering.", "Start selling"],
      [{ kind: "pending" }, "Your shop can make offers once the Hub approves it.", "Go to your shop"],
      [{ kind: "paused" }, "Your shop is paused, so it can't make offers right now.", "Go to your shop"],
      [{ kind: "own" }, "This is your request, so you can't offer on it.", null],
      [{ kind: "closed" }, "This request is closed, so it isn't taking offers.", null],
      [{ kind: "sample" }, "This is one of CampusCart's sample requests, so it can't take offers.", null],
      [{ kind: "offered", conversationId: "conv-abc" }, "You've offered already.", "Open the conversation"],
    ];
    for (const [status, sentence, link] of cases) {
      const { unmount } = render(<OfferView subject={SUBJECT} status={status} form={EMPTY} />);
      expect(screen.getByText(sentence)).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Send offer" })).toBeNull();
      if (link) expect(screen.getByRole("link", { name: link })).toBeInTheDocument();
      unmount();
    }
    render(<OfferView subject={SUBJECT} status={{ kind: "offered", conversationId: "conv-abc" }} form={EMPTY} />);
    expect(screen.getByRole("link", { name: "Open the conversation" })).toHaveAttribute("href", "/messages/conv-abc");
  });

  it("keeps the typed offer and says what's wrong, or asks to check scam words, with Send anyway", () => {
    const state = (errors: string[], notice: string | null, values: Record<string, string>) => ({
      key: "s:offer:r-001",
      sessionKey: "s",
      form: "offer:r-001",
      errors,
      values,
      notice,
      expiresAt: "2026-10-14T08:52:00.000Z",
    });
    const { unmount } = render(
      <OfferView
        subject={SUBJECT}
        status={OPEN}
        form={offerForm(state(["offer-rate"], null, { body: "Hi", listing: "l-001" }), "offer-r-001")}
      />,
    );
    expect(screen.getByRole("alert", { name: "There's a problem" })).toHaveAttribute("id", "offer-r-001-summary");
    expect(screen.getByLabelText("Your offer")).toHaveValue("Hi");
    expect(screen.getByLabelText("Point to one of your listings (optional)")).toHaveValue("l-001");
    unmount();
    render(
      <OfferView
        subject={SUBJECT}
        status={OPEN}
        form={offerForm(
          state([], "check", { body: "Pay a deposit first.", listing: "", warnings: "deposit" }),
          "offer-r-001",
        )}
      />,
    );
    expect(screen.getByRole("alert", { name: "Check this before you send" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send anyway" })).toHaveAttribute("value", "yes");
  });
});
