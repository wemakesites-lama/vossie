import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { OwnRequest } from "@/lib/types";
import { YourRequestsView } from "./YourRequestsView";

vi.mock("@/lib/looking-for/actions", () => ({ closeMyRequest: async () => {}, reopenMyRequest: async () => {} }));

const own = (id: string, title: string, state: OwnRequest["state"], hiddenReason: string | null = null): OwnRequest => ({
  request: {
    id,
    title,
    campusSlug: "midrand",
    offers: state === "open" ? 2 : 0,
    details: "Some details that are long enough.",
    categorySlug: "res-living",
    budgetZar: null,
    swapWelcome: false,
    neededBy: null,
    createdAt: "2026-10-13T07:30:00.000Z",
    status: state === "closed" ? "closed" : "open",
  },
  state,
  hiddenReason,
});

const ITEMS = [
  own("r-a", "Desk lamp for res", "open"),
  own("r-b", "Kettle for res", "closed"),
  own("r-c", "Exam answers", "hidden", "Selling exam answers isn't allowed."),
];

describe("Your requests (community actions spec 2.13, plan decision 18)", () => {
  it("lists each request with its state, offers and date, and the actions its state allows", () => {
    render(<YourRequestsView items={ITEMS} notice={null} />);
    expect(screen.getByRole("heading", { level: 1, name: "Your requests" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Post a request" })).toHaveAttribute("href", "/looking-for/new");
    const [open, closed, hidden] = screen.getAllByRole("listitem");
    expect(within(open).getByRole("link", { name: "Desk lamp for res" })).toHaveAttribute("href", "/looking-for/r-a");
    expect(open).toHaveTextContent("Open · 2 offers · Posted 13 Oct");
    expect(within(open).getByRole("link", { name: "Edit Desk lamp for res" })).toHaveAttribute(
      "href",
      "/looking-for/r-a/edit",
    );
    expect(within(open).getByRole("button", { name: "Close Desk lamp for res" })).toHaveAttribute("type", "submit");
    expect(within(open).getByRole("link", { name: "Delete Desk lamp for res" })).toHaveAttribute(
      "href",
      "/looking-for/r-a/delete",
    );
    expect(within(closed).getByRole("button", { name: "Reopen Kettle for res" })).toBeInTheDocument();
    expect(within(closed).queryByRole("link", { name: /^Edit/ })).toBeNull();
    expect(within(hidden).queryByRole("link", { name: "Exam answers" })).toBeNull();
    expect(hidden).toHaveTextContent("Hidden by the Hub");
    expect(hidden).toHaveTextContent("The Hub's reason: Selling exam answers isn't allowed.");
    expect(within(hidden).queryByRole("button")).toBeNull();
    expect(within(hidden).getByRole("link", { name: "Delete Exam answers" })).toBeInTheDocument();
  });

  it("posts Close and Reopen from the list, so they land back here", () => {
    render(<YourRequestsView items={ITEMS} notice={null} />);
    for (const input of document.querySelectorAll('input[name="from"]')) expect(input).toHaveValue("list");
    expect(document.querySelectorAll('input[name="from"]')).toHaveLength(2);
  });

  it("says what the last action did, and invites a first request when there's none", () => {
    const { unmount } = render(<YourRequestsView items={ITEMS} notice="Request deleted." />);
    expect(screen.getByRole("status")).toHaveTextContent("Request deleted.");
    unmount();
    render(<YourRequestsView items={[]} notice={null} />);
    expect(screen.getByText("You haven't asked for anything yet.")).toBeInTheDocument();
  });
});
