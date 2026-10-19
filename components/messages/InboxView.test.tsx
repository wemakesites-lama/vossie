import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { makeSummary } from "@/tests/helpers/fakes";
import { prefetchingLinks } from "@/tests/helpers/next-link";
import { InboxView } from "./InboxView";
import { StatusPill } from "./StatusPill";

// Link shows its prefetch as data-prefetch, to check that no link here prefetches (decision 53).
vi.mock("next/link", async () => (await import("@/tests/helpers/next-link")).nextLinkShowingPrefetch);

// Wednesday 14 October 2026, 15:00 in South Africa.
const NOW = new Date("2026-10-14T13:00:00Z");

describe("the inbox (messaging spec 3.2)", () => {
  it("has the Buying and Selling tabs only for an account with a shop, marking the open one (spec 2.10)", () => {
    const { unmount } = render(<InboxView tab="buying" hasShop={false} conversations={[]} now={NOW} />);
    expect(screen.queryByRole("navigation", { name: "Buying and selling" })).toBeNull();
    unmount();
    render(<InboxView tab="selling" hasShop conversations={[]} now={NOW} />);
    const tabs = screen.getByRole("navigation", { name: "Buying and selling" });
    const buying = within(tabs).getByRole("link", { name: "Buying" });
    const selling = within(tabs).getByRole("link", { name: "Selling" });
    expect(buying).toHaveAttribute("href", "/messages");
    expect(buying).not.toHaveAttribute("aria-current");
    expect(selling).toHaveAttribute("href", "/messages?tab=selling");
    expect(selling).toHaveAttribute("aria-current", "page");
  });

  it("lists each conversation as a link to its thread: who, what about, the last line, when, the status, unread", () => {
    render(
      <InboxView
        tab="buying"
        hasShop={false}
        now={NOW}
        conversations={[
          makeSummary({
            id: "conv-a",
            listingTitle: "Gaming headset, barely used",
            preview: "Can I see the speaker first?",
            lastMessageAt: "2026-10-14T12:05:00Z",
            status: "replied",
            unread: true,
          }),
          makeSummary({
            id: "conv-b",
            otherName: "Book swap",
            listingTitle: null,
            image: null,
            preview: "Do you have Accounting 2?",
            lastFromViewer: true,
            lastMessageAt: "2026-10-12T08:00:00Z",
          }),
        ]}
      />,
    );
    const rows = within(screen.getByRole("region", { name: "Buying" })).getAllByRole("listitem");
    expect(rows).toHaveLength(2);
    expect(within(rows[0]).getByRole("link")).toHaveAttribute("href", "/messages/conv-a");
    expect(within(rows[0]).getByText("Unread,")).toHaveClass("sr-only");
    expect(within(rows[0]).getByText("Tech corner")).toBeInTheDocument();
    expect(within(rows[0]).getByText("14:05")).toHaveAttribute("datetime", "2026-10-14T12:05:00Z");
    expect(within(rows[0]).getByText("Gaming headset, barely used")).toBeInTheDocument();
    expect(within(rows[0]).getByText("Can I see the speaker first?")).toBeInTheDocument();
    expect(within(rows[0]).getByText("Replied")).toHaveAttribute("data-status", "replied");
    expect(within(rows[1]).getByRole("link")).toHaveAttribute("href", "/messages/conv-b");
    expect(within(rows[1]).getByText("You: Do you have Accounting 2?")).toBeInTheDocument();
    expect(within(rows[1]).getByText("A question for the shop")).toBeInTheDocument();
    expect(within(rows[1]).getByText("Mon")).toBeInTheDocument();
    expect(within(rows[1]).queryByText("Unread,")).toBeNull();
  });

  it("invites a buyer with no messages to browse (spec 3.2)", () => {
    render(<InboxView tab="buying" hasShop={false} conversations={[]} now={NOW} />);
    expect(screen.getByText("No messages yet. Find something you like and message the seller.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Browse" })).toHaveAttribute("href", "/browse");
  });

  it("doesn't prefetch Browse, nor any other link (CLAUDE.md, decision 53, plan amendment 6)", () => {
    const empty = render(<InboxView tab="buying" hasShop={false} conversations={[]} now={NOW} />);
    expect(screen.getByRole("link", { name: "Browse" })).toHaveAttribute("data-prefetch", "false");
    expect(prefetchingLinks(empty.container)).toEqual([]);
    empty.unmount();
    const full = render(<InboxView tab="selling" hasShop conversations={[makeSummary()]} now={NOW} />);
    expect(full.container.querySelectorAll("a[data-prefetch]").length).toBeGreaterThan(0);
    expect(prefetchingLinks(full.container)).toEqual([]);
  });

  it("tells a seller with no enquiries where they'll show up (plan decision 26)", () => {
    render(<InboxView tab="selling" hasShop conversations={[]} now={NOW} />);
    expect(screen.getByText("No enquiries yet. When a buyer messages your shop, it shows up here.")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Browse" })).toBeNull();
  });

  it("has Refresh, a full page load of the same tab (plan decision 19)", () => {
    render(<InboxView tab="selling" hasShop conversations={[makeSummary()]} now={NOW} />);
    expect(screen.getByRole("link", { name: "Refresh" })).toHaveAttribute("href", "/messages?tab=selling");
  });
});

describe("StatusPill (messaging spec 2.5 and section 5)", () => {
  it("says the status in words", () => {
    render(
      <>
        <StatusPill status="asked" />
        <StatusPill status="replied" />
        <StatusPill status="done" />
        <StatusPill status="confirmed" />
      </>,
    );
    expect(["Asked", "Replied", "Done", "Confirmed"].map((label) => screen.getByText(label).dataset.status)).toEqual([
      "asked",
      "replied",
      "done",
      "confirmed",
    ]);
  });
});

describe("offer threads in the inbox (community actions plan decisions 8 and 9)", () => {
  it("names them by their request: Request for the shop, Your request for the asker", () => {
    const { unmount } = render(
      <InboxView
        tab="selling"
        hasShop
        conversations={[
          makeSummary({
            role: "seller",
            otherName: "The student who asked",
            requestTitle: "Desk lamp for res",
            listingTitle: null,
            status: "offered",
          }),
        ]}
        now={NOW}
      />,
    );
    expect(screen.getByRole("link", { name: /Request: Desk lamp for res/ })).toHaveTextContent("The student who asked");
    expect(screen.getByText("Offered")).toHaveAttribute("data-status", "offered");
    unmount();
    render(
      <InboxView
        tab="buying"
        hasShop={false}
        conversations={[makeSummary({ role: "buyer", otherName: "Tech corner", requestTitle: "Desk lamp for res" })]}
        now={NOW}
      />,
    );
    expect(screen.getByRole("link", { name: /Your request: Desk lamp for res/ })).toBeInTheDocument();
  });
});
