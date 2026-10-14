import { render, screen, within } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { getListingDetail, getSeller } from "@/lib/data";
import { MessageField } from "./MessageField";
import { MessageSummary } from "./MessageSummary";
import { SafetyTips } from "./SafetyTips";
import { ScamCheck } from "./ScamCheck";

describe("MessageSummary (messaging spec 3.1 and 3.3)", () => {
  it("shows the listing's photo, title, price, seller and campus, the title linking to the listing", async () => {
    const detail = (await getListingDetail("l-001"))!;
    render(<MessageSummary listing={detail.listing} listingTitle={null} shop={detail.seller} campusName="Midrand" />);
    expect(screen.getByRole("link", { name: "Casio fx-991ZA Plus calculator" })).toHaveAttribute("href", "/listings/l-001");
    expect(screen.getByText("R250 · Tech corner · Midrand")).toBeInTheDocument();
    // The photo is decorative: the title next to it says what it is.
    expect(document.querySelector("img")).toHaveAttribute("alt", "");
  });

  it("says when the listing has been removed, keeping its title (selling spec 9)", () => {
    render(
      <MessageSummary
        listing={null}
        listingTitle="Casio fx-991ZA Plus calculator"
        shop={{ slug: "tech-corner", name: "Tech corner", image: null }}
        campusName="Midrand"
      />,
    );
    expect(screen.getByText("Casio fx-991ZA Plus calculator")).not.toHaveAttribute("href");
    expect(screen.getByText("This listing has been removed.")).toBeInTheDocument();
    expect(document.querySelector("img")).toBeNull();
  });

  it("shows the shop for a question to the shop (plan decision 2)", async () => {
    render(<MessageSummary listing={null} listingTitle={null} shop={(await getSeller("tech-corner"))!} campusName="Midrand" />);
    expect(screen.getByRole("link", { name: "Tech corner" })).toHaveAttribute("href", "/sellers/tech-corner");
    expect(screen.getByText("A question for the shop · Midrand")).toBeInTheDocument();
  });
});

describe("SafetyTips (messaging spec 2.3)", () => {
  it("always shows the three tips, with the way to the safety page", () => {
    render(<SafetyTips />);
    const tips = screen.getByRole("region", { name: "Stay safe" });
    expect(within(tips).getAllByRole("listitem")).toHaveLength(3);
    expect(within(tips).getByRole("link", { name: "More safety tips" })).toHaveAttribute("href", "/safety");
  });
});

describe("ScamCheck (messaging spec 2.3, plan decision 9)", () => {
  it("is nothing when nothing matched", () => {
    const { container } = render(<ScamCheck warnings={[]} idPrefix="composer" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("says what to check, with each matching tip and Send anyway, and is focused on a page load", () => {
    render(<ScamCheck warnings={["deposit", "code"]} idPrefix="composer" />);
    const check = screen.getByRole("alert", { name: "Check this before you send" });
    expect(within(check).getAllByRole("listitem").map((item) => item.textContent)).toEqual([
      "Don't pay a deposit or a booking fee to hold something. A real seller can wait until you meet.",
      "Never share a code sent to your phone. Anyone who asks for one is trying to get into your accounts.",
    ]);
    const anyway = within(check).getByRole("button", { name: "Send anyway" });
    expect(anyway).toHaveAttribute("type", "submit");
    expect(anyway).toHaveAttribute("name", "anyway");
    expect(anyway).toHaveAttribute("value", "yes");
    expect(renderToString(<ScamCheck warnings={["bank"]} idPrefix="composer" />)).toMatch(
      /<div[^>]*role="alert"[^>]*autofocus=""/,
    );
  });
});

describe("MessageField (messaging spec 3.1 and section 5)", () => {
  it("is a labelled text area with its hint, and its error when there is one", () => {
    const { rerender } = render(
      <MessageField id="composer-body" name="body" label="Your message" hint="Up to 1,000 characters." defaultValue="" error={undefined} rows={6} required />,
    );
    const field = screen.getByLabelText("Your message");
    expect(field.tagName).toBe("TEXTAREA");
    expect(field).toHaveAttribute("name", "body");
    expect(field).not.toHaveAttribute("maxlength");
    expect(field).toHaveAccessibleDescription("Up to 1,000 characters.");
    rerender(
      <MessageField
        id="composer-body"
        name="body"
        label="Your message"
        hint="Up to 1,000 characters."
        defaultValue="Hi"
        error="Write a message first."
        rows={6}
        required
      />,
    );
    expect(field).toHaveAttribute("aria-invalid", "true");
    expect(field).toHaveAccessibleDescription("Up to 1,000 characters. Error: Write a message first.");
  });
});
