import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { FormStateRow } from "@/lib/data/rows";
import type { MessageTarget } from "@/lib/messaging/paths";
import { composerSubject } from "@/lib/messaging/subjects";
import { composerForm, ComposerView, type ComposerStatus } from "./ComposerView";

// The form only needs something to post to; the action has its own test.
vi.mock("@/lib/messaging/actions", () => ({ sendFirstMessage: async () => {} }));

const EMPTY = composerForm(null);

const state = (fields: Partial<FormStateRow>): FormStateRow => ({
  key: "s:composer:listing:l-007",
  sessionKey: "s",
  form: "composer:listing:l-007",
  errors: [],
  values: {},
  notice: null,
  expiresAt: "2099-01-01T00:00:00.000Z",
  ...fields,
});

async function show(target: MessageTarget, status: ComposerStatus = { kind: "open" }, form = EMPTY) {
  const subject = (await composerSubject(target))!;
  return render(<ComposerView subject={subject} status={status} form={form} />);
}

const hidden = (container: HTMLElement) =>
  [...container.querySelectorAll<HTMLInputElement>('input[type="hidden"]')].map((input) => [input.name, input.value]);

describe("the composer (messaging spec 3.1)", () => {
  it("heads the page with the shop, shows the listing, and asks for a message", async () => {
    const { container } = await show({ kind: "listing", listingId: "l-001" });
    expect(screen.getByRole("heading", { level: 1, name: "Message Tech corner" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to the listing" })).toHaveAttribute("href", "/listings/l-001");
    expect(screen.getByRole("link", { name: "Casio fx-991ZA Plus calculator" })).toBeInTheDocument();
    const message = screen.getByLabelText("Your message");
    expect(message).toHaveAccessibleDescription(/^Up to 1,000 characters\./);
    expect(screen.queryByLabelText("Offer a swap (optional)")).toBeNull();
    expect(screen.getByRole("button", { name: "Send" })).toHaveAttribute("type", "submit");
    expect(hidden(container)).toEqual([["listing", "l-001"]]);
    expect(screen.getByRole("region", { name: "Stay safe" })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("offers a swap when the listing takes swaps, saying what the seller would swap for (spec 2.4)", async () => {
    await show({ kind: "listing", listingId: "l-007" });
    const swap = screen.getByLabelText("Offer a swap (optional)");
    expect(swap.tagName).toBe("TEXTAREA");
    expect(swap).toHaveAccessibleDescription(
      "Tech corner would swap for a mechanical keyboard or a Bluetooth speaker. Up to 200 characters.",
    );
  });

  it("keeps what was typed and shows what's wrong after a failed post", async () => {
    const form = composerForm(
      state({ errors: ["message-missing", "swap-length"], values: { body: "", swapOffer: "x".repeat(201) } }),
    );
    await show({ kind: "listing", listingId: "l-007" }, { kind: "open" }, form);
    const summary = screen.getByRole("alert", { name: "There's a problem" });
    expect(within(summary).getAllByRole("link").map((link) => link.getAttribute("href"))).toEqual([
      "#composer-body",
      "#composer-swap",
    ]);
    expect(screen.getByLabelText("Offer a swap (optional)")).toHaveValue("x".repeat(201));
    expect(screen.getByLabelText("Your message")).toHaveAttribute("aria-invalid", "true");
  });

  it("warns about scam words with the message kept, and offers Send anyway (spec 2.3)", async () => {
    const form = composerForm(
      state({ notice: "check", values: { body: "Can I pay a deposit first?", swapOffer: "", warnings: "advance,deposit" } }),
    );
    await show({ kind: "listing", listingId: "l-001" }, { kind: "open" }, form);
    expect(screen.getByLabelText("Your message")).toHaveValue("Can I pay a deposit first?");
    const check = screen.getByRole("alert", { name: "Check this before you send" });
    expect(within(check).getAllByRole("listitem")).toHaveLength(2);
    // Send comes before Send anyway, so Enter in a field never sends anyway.
    expect(screen.getAllByRole("button").map((button) => button.textContent)).toEqual(["Send", "Send anyway"]);
  });

  it("asks a shop a question, with no swap, and goes back to the shop (plan decision 2)", async () => {
    const { container } = await show({ kind: "shop", sellerSlug: "tech-corner" });
    expect(screen.getByRole("link", { name: "Back to the shop" })).toHaveAttribute("href", "/sellers/tech-corner");
    expect(screen.getByText("A question for the shop · Midrand")).toBeInTheDocument();
    expect(screen.queryByLabelText("Offer a swap (optional)")).toBeNull();
    expect(hidden(container)).toEqual([["shop", "tech-corner"]]);
  });

  it("says why there's no form: your own listing, a listing or shop that isn't available, a conversation already", async () => {
    const { unmount } = await show({ kind: "listing", listingId: "l-001" }, { kind: "own" });
    expect(screen.getByText("This is your listing, so you can't message yourself.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Send" })).toBeNull();
    unmount();
    const again = await show({ kind: "listing", listingId: "l-026" }, { kind: "unavailable", conversationId: null });
    expect(screen.getByText("This listing isn't available right now, so it can't be messaged.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "See similar items" })).toHaveAttribute("href", "/browse?cat=tech");
    again.unmount();
    // A paused shop (selling plan amendment 10).
    const shop = await show({ kind: "shop", sellerSlug: "tech-corner" }, { kind: "unavailable", conversationId: null });
    expect(screen.getByText("This shop isn't taking orders right now, so it can't be messaged.")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "See similar items" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Open the conversation" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Send" })).toBeNull();
    shop.unmount();
    await show({ kind: "listing", listingId: "l-001" }, { kind: "existing", conversationId: "conv-s2" });
    expect(screen.getByText("You've already messaged Tech corner about this.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open the conversation" })).toHaveAttribute("href", "/messages/conv-s2");
  });

  it("keeps the way into a conversation already started when the shop or listing stops taking messages", async () => {
    const shop = await show(
      { kind: "shop", sellerSlug: "tech-corner" },
      { kind: "unavailable", conversationId: "conv-q1" },
    );
    expect(screen.getByText("This shop isn't taking orders right now, so it can't be messaged.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open the conversation" })).toHaveAttribute("href", "/messages/conv-q1");
    shop.unmount();
    await show({ kind: "listing", listingId: "l-026" }, { kind: "unavailable", conversationId: "conv-s9" });
    expect(screen.getByText("This listing isn't available right now, so it can't be messaged.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open the conversation" })).toHaveAttribute("href", "/messages/conv-s9");
    expect(screen.getByRole("link", { name: "See similar items" })).toBeInTheDocument();
  });
});
