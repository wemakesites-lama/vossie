import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { FormStateRow } from "@/lib/data/rows";
import { makeListing, makeThread } from "@/tests/helpers/fakes";
import { replyForm, ThreadView } from "./ThreadView";

// The forms only need something to post to; the actions have their own tests.
vi.mock("@/lib/messaging/actions", () => ({
  confirmTheSale: async () => {},
  markAsCompleted: async () => {},
  saleDidntHappen: async () => {},
  sendReply: async () => {},
}));

// Wednesday 14 October 2026, 15:00 in South Africa.
const NOW = new Date("2026-10-14T13:00:00Z");
const EMPTY = replyForm(null, "conv-test");

function show(thread = makeThread(), { sent = false, reply = EMPTY } = {}) {
  return render(<ThreadView thread={thread} now={NOW} reply={reply} sent={sent} campusName="Midrand" />);
}

const state = (fields: Partial<FormStateRow>): FormStateRow => ({
  key: "s:reply:conv-test",
  sessionKey: "s",
  form: "reply:conv-test",
  errors: [],
  values: {},
  notice: null,
  expiresAt: "2099-01-01T00:00:00.000Z",
  ...fields,
});

describe("a thread (messaging spec 3.3)", () => {
  it("is headed by the other side, with the way back, Refresh, and the listing with its status", () => {
    show();
    expect(screen.getByRole("heading", { level: 1, name: "Messages with Tech corner" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to messages" })).toHaveAttribute("href", "/messages");
    expect(screen.getByRole("link", { name: "Refresh" })).toHaveAttribute("href", "/messages/conv-test");
    expect(screen.getByRole("link", { name: "Test listing" })).toHaveAttribute("href", "/listings/l-test");
    expect(screen.getByText("Asked")).toHaveClass("status-pill");
  });

  it("goes back to Selling for the seller", () => {
    show(makeThread({ role: "seller", otherName: "Ayanda" }));
    expect(screen.getByRole("link", { name: "Back to messages" })).toHaveAttribute("href", "/messages?tab=selling");
    expect(screen.getByRole("heading", { level: 1, name: "Messages with Ayanda" })).toBeInTheDocument();
  });

  it("lists the messages in order, each saying who wrote it and when, in words (spec section 5)", () => {
    show(
      makeThread({
        messages: [
          {
            id: "m1",
            fromViewer: true,
            author: "You",
            body: "Would you swap?\nI can meet at the library.",
            swapOffer: "A mechanical keyboard",
            sentAt: "2026-10-12T08:00:00Z",
          },
          { id: "m2", fromViewer: false, author: "Tech corner", body: "Yes!", swapOffer: null, sentAt: "2026-10-14T12:05:00Z" },
        ],
      }),
    );
    const items = within(screen.getByRole("region", { name: "Messages" })).getAllByRole("listitem");
    expect(items.map((item) => item.dataset.from)).toEqual(["you", "them"]);
    expect(within(items[0]).getByText("You")).toBeInTheDocument();
    expect(within(items[0]).getByText("12 Oct, 10:00")).toHaveAttribute("datetime", "2026-10-12T08:00:00Z");
    expect(within(items[0]).getByText(/^Would you swap\?/).textContent).toBe("Would you swap?\nI can meet at the library.");
    expect(within(items[0]).getByText("Swap offer:").closest("p")).toHaveTextContent("Swap offer: A mechanical keyboard");
    expect(within(items[1]).getByText("Tech corner")).toBeInTheDocument();
    expect(within(items[1]).getByText("14:05")).toBeInTheDocument();
  });

  it("shows a message's text as text: no markup, and no links made from addresses (spec 2.12)", () => {
    const { container } = show(
      makeThread({
        messages: [
          {
            id: "m1",
            fromViewer: false,
            author: "Tech corner",
            body: "<b>Pay here</b> https://example.com",
            swapOffer: null,
            sentAt: "2026-10-14T12:05:00Z",
          },
        ],
      }),
    );
    expect(screen.getByText("<b>Pay here</b> https://example.com")).toBeInTheDocument();
    expect(container.querySelector(".thread-list b, .thread-list a")).toBeNull();
  });

  it("says \"Sent.\" once, after the composer (plan decision 7)", () => {
    const { unmount } = show(makeThread(), { sent: true });
    expect(screen.getByRole("status")).toHaveTextContent("Sent. Sellers usually reply within a day.");
    unmount();
    show();
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("has a labelled reply form that posts the conversation's id and keeps a failed reply (section 5)", () => {
    const { container } = show(makeThread(), {
      reply: replyForm(state({ errors: ["message-missing"], values: { body: "" } }), "conv-test"),
    });
    const reply = screen.getByRole("region", { name: "Reply" });
    expect(within(reply).getByLabelText("Your reply")).toHaveAttribute("aria-invalid", "true");
    expect(within(reply).getByRole("alert", { name: "There's a problem" })).toBeInTheDocument();
    expect(within(reply).getByRole("button", { name: "Send" })).toHaveAttribute("type", "submit");
    expect(container.querySelector<HTMLInputElement>('input[name="conversation"]')?.value).toBe("conv-test");
  });

  it("gives the reply form's error summary its own id (messaging plan amendment 1)", () => {
    show(makeThread(), {
      reply: replyForm(state({ errors: ["message-missing"], values: { body: "" } }), "conv-test"),
    });
    expect(screen.getByRole("alert", { name: "There's a problem" })).toHaveAttribute("id", "thread-reply-summary");
  });

  it("warns about scam words in a reply, with Send anyway (plan decision 9)", () => {
    show(makeThread(), {
      reply: replyForm(
        state({ notice: "check", values: { body: "Send your banking details", warnings: "bank" } }),
        "conv-test",
      ),
    });
    expect(screen.getByLabelText("Your reply")).toHaveValue("Send your banking details");
    expect(screen.getByRole("alert", { name: "Check this before you send" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send anyway" })).toBeInTheDocument();
  });

  it("has no reply form once the other side has left (messaging plan amendment 3, item 9)", () => {
    show(makeThread({ otherName: "Deleted account", otherPresent: false }));
    expect(screen.queryByLabelText("Your reply")).toBeNull();
    expect(screen.getByRole("heading", { level: 1, name: "Messages with Deleted account" })).toBeInTheDocument();
    expect(screen.getByText("This person has left Vossie, so you can't reply.")).toBeInTheDocument();
  });
});

describe("the sale (messaging spec 2.5, plan decision 30)", () => {
  it("offers the seller Mark as completed once they've replied", () => {
    const { container } = show(makeThread({ role: "seller", otherName: "Ayanda", status: "replied" }));
    expect(screen.getByRole("button", { name: "Mark as completed" })).toHaveAttribute("type", "submit");
    expect(screen.getByText("When the sale or swap has happened. Ayanda is then asked to confirm it.")).toBeInTheDocument();
    expect(container.querySelectorAll('input[name="conversation"]')).toHaveLength(2);
  });

  it("offers the seller no Mark as completed when the buyer has left (messaging plan amendment 3, items 1 and 3)", () => {
    show(makeThread({ role: "seller", otherName: "Deleted account", otherPresent: false, status: "replied" }));
    expect(screen.queryByRole("button", { name: "Mark as completed" })).toBeNull();
    expect(screen.getByText("This person has left Vossie, so you can't reply.")).toBeInTheDocument();
  });

  it("asks the buyer whether a sale marked done happened, and says when it confirms itself", () => {
    show(makeThread({ status: "done", completedAt: "2026-10-13T15:00:00.000Z" }));
    const ask = screen.getByRole("region", { name: "Did the sale happen?" });
    expect(within(ask).getByText(/^Tech corner marked this as completed on 13 Oct\./)).toHaveTextContent(
      "Tech corner marked this as completed on 13 Oct. If you don't answer, it confirms itself on 20 Oct.",
    );
    expect(within(ask).getByRole("button", { name: "Confirm the sale" })).toBeInTheDocument();
    expect(within(ask).getByRole("button", { name: "It didn't happen" })).toBeInTheDocument();
  });

  it("asks the buyer nothing when the seller has left, since nobody stands behind the sale (messaging plan amendment 6, fix 2)", () => {
    show(
      makeThread({
        status: "done",
        completedAt: "2026-10-13T15:00:00.000Z",
        otherName: "Deleted account",
        otherPresent: false,
      }),
    );
    expect(screen.queryByRole("region", { name: "Did the sale happen?" })).toBeNull();
    expect(screen.queryByRole("button", { name: /Confirm the sale|It didn't happen/ })).toBeNull();
    expect(screen.getByText("This person has left Vossie, so you can't reply.")).toBeInTheDocument();
  });

  it("tells the seller nothing is waiting when the buyer has left, the same rule from the other side", () => {
    show(
      makeThread({
        role: "seller",
        status: "done",
        completedAt: "2026-10-13T15:00:00.000Z",
        otherName: "Deleted account",
        otherPresent: false,
      }),
    );
    expect(screen.queryByText(/You marked this as completed/)).toBeNull();
    expect(screen.getByText("This person has left Vossie, so you can't reply.")).toBeInTheDocument();
  });

  it("tells the seller they're waiting for the buyer", () => {
    show(makeThread({ role: "seller", otherName: "Ayanda", status: "done", completedAt: "2026-10-13T15:00:00.000Z" }));
    expect(screen.getByText(/^You marked this as completed on 13 Oct\./)).toHaveTextContent(
      "You marked this as completed on 13 Oct. Ayanda is asked to confirm it; if they don't answer, it confirms itself on 20 Oct.",
    );
    expect(screen.queryByRole("button", { name: "Confirm the sale" })).toBeNull();
  });

  it("says when and how a sale was confirmed", () => {
    const { unmount } = show(
      makeThread({ status: "confirmed", confirmedAt: "2026-10-14T09:00:00.000Z", confirmedBy: "buyer" }),
    );
    expect(screen.getByText("Sale confirmed on 14 Oct.")).toBeInTheDocument();
    unmount();
    show(makeThread({ status: "confirmed", confirmedAt: "2026-10-20T15:00:00.000Z", confirmedBy: "auto" }));
    expect(
      screen.getByText("Sale confirmed automatically on 20 Oct, a week after it was marked completed."),
    ).toBeInTheDocument();
  });

  it("offers nothing before a reply, nor to a buyer before the sale is marked done", () => {
    const { unmount } = show(makeThread({ role: "seller", otherName: "Ayanda", status: "asked" }));
    expect(screen.queryByRole("button", { name: "Mark as completed" })).toBeNull();
    unmount();
    show(makeThread({ status: "replied" }));
    expect(screen.queryByRole("button", { name: /Mark as completed|Confirm the sale/ })).toBeNull();
  });
});

describe("offer threads (community actions spec 2.7 to 2.10, plan decision 8)", () => {
  const OFFER_NOW = new Date("2026-10-14T12:00:00.000Z");
  const offer = makeThread({
    status: "offered",
    request: { id: "r-abc", title: "Desk lamp for res", live: true, hidden: false },
    listing: null,
    listingTitle: null,
    messages: [
      {
        id: "msg-1",
        fromViewer: false,
        author: "Tech corner",
        body: "I have a clip-on lamp, R120.",
        swapOffer: null,
        sentAt: "2026-10-14T10:00:00.000Z",
      },
    ],
  });

  it("names the request, linked to its page, with the Offered pill; the asker can reply", () => {
    render(
      <ThreadView thread={offer} now={OFFER_NOW} reply={replyForm(null, offer.id)} sent={false} campusName="Midrand" />,
    );
    expect(screen.getByText(/^Your request:/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Desk lamp for res" })).toHaveAttribute("href", "/looking-for/r-abc");
    expect(screen.getByText("Offered")).toHaveClass("status-pill");
    expect(screen.getByLabelText("Your reply")).toBeInTheDocument();
  });

  it("makes the shop wait for the asker's reply, and says Sent. in the shop's words", () => {
    const seller = { ...offer, role: "seller" as const, otherName: "The student who asked" };
    render(
      <ThreadView thread={seller} now={OFFER_NOW} reply={replyForm(null, offer.id)} sent campusName="Midrand" />,
    );
    expect(screen.getByText(/^Request:/)).toBeInTheDocument();
    expect(screen.getByText("You can write again when they reply.")).toBeInTheDocument();
    expect(screen.queryByLabelText("Your reply")).toBeNull();
    expect(screen.getByRole("status")).toHaveTextContent("Sent. The student who asked gets a notification.");
    expect(screen.queryByRole("button", { name: "Mark as completed" })).toBeNull();
  });

  it("gives the shop its reply form back once the asker has replied", () => {
    const seller = { ...offer, role: "seller" as const, otherName: "Thandi", status: "replied" as const };
    render(
      <ThreadView thread={seller} now={OFFER_NOW} reply={replyForm(null, offer.id)} sent={false} campusName="Midrand" />,
    );
    expect(screen.queryByText("You can write again when they reply.")).toBeNull();
    expect(screen.getByLabelText("Your reply")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mark as completed" })).toBeInTheDocument();
  });

  it("says when the request has gone, and shows the listing the shop pointed to", () => {
    render(
      <ThreadView
        thread={{
          ...offer,
          request: { id: "r-abc", title: "Desk lamp for res", live: false, hidden: false },
          listing: makeListing({ id: "l-test", title: "Clip-on lamp" }),
          listingTitle: "Clip-on lamp",
        }}
        now={OFFER_NOW}
        reply={replyForm(null, offer.id)}
        sent={false}
        campusName="Midrand"
      />,
    );
    expect(screen.queryByRole("link", { name: "Desk lamp for res" })).toBeNull();
    expect(screen.getByText("This request was removed.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Clip-on lamp" })).toHaveAttribute("href", "/listings/l-test");
  });

  it("keeps the other conversations' note and the left-Vossie line (messaging amendment 3.9)", () => {
    const { unmount } = show(makeThread(), { sent: true });
    expect(screen.getByRole("status")).toHaveTextContent("Sent. Sellers usually reply within a day.");
    unmount();
    show(makeThread({ otherPresent: false, otherName: "Deleted account" }));
    expect(screen.getByText("This person has left Vossie, so you can't reply.")).toBeInTheDocument();
    expect(screen.queryByLabelText("Your reply")).toBeNull();
  });

  // Plan amendment 19.2: the asker dealt with a shop, so a shop that has gone is a shop that has closed.
  it("tells the asker the shop has closed, not that a person has left; the shop still reads about a person", () => {
    const { unmount } = show({ ...offer, otherPresent: false, otherName: "A closed shop" });
    expect(screen.getByText("This shop has closed, so you can't reply.")).toBeInTheDocument();
    expect(screen.queryByText(/has left Vossie/)).toBeNull();
    expect(screen.queryByLabelText("Your reply")).toBeNull();
    unmount();
    show({ ...offer, role: "seller", otherPresent: false, otherName: "Deleted account" });
    expect(screen.getByText("This person has left Vossie, so you can't reply.")).toBeInTheDocument();
    expect(screen.queryByText(/shop has closed/)).toBeNull();
  });

  it("says the offer was sent only while the asker hasn't replied, and never with the sellers' line", () => {
    const seller = { ...offer, role: "seller" as const, otherName: "Thandi" };
    const { unmount } = show({ ...seller, status: "replied" }, { sent: true });
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.queryByText(/Sent\./)).toBeNull();
    unmount();
    show({ ...seller, status: "offered" }, { sent: true });
    expect(screen.getByRole("status")).toHaveTextContent("Sent. The student who asked gets a notification.");
  });

  // Plan amendment 19.4: the Hub hiding a request is not the asker taking it down.
  it("tells the asker the Hub hid the request, and the shop only that it was removed", () => {
    const hidden = { id: "r-abc", title: "Desk lamp for res", live: false, hidden: true };
    const { unmount } = show({ ...offer, request: hidden });
    expect(screen.getByText("The Hub hid this request.")).toBeInTheDocument();
    expect(screen.queryByText("This request was removed.")).toBeNull();
    expect(screen.queryByRole("link", { name: "Desk lamp for res" })).toBeNull();
    unmount();
    show({ ...offer, role: "seller", otherName: "The student who asked", request: hidden });
    expect(screen.getByText("This request was removed.")).toBeInTheDocument();
    expect(screen.queryByText("The Hub hid this request.")).toBeNull();
  });
});
