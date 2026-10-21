import { render, screen, within } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
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
    closesOn: null,
  },
  state,
  hiddenReason,
  closedAt: null,
  closedAutomatically: false,
  closeReason: null,
  neededByPassed: false,
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

// Plan amendment 19.10: the title link is a tap target, so it is 44px tall (the tap targets rule). A test of the CSS text.
describe("the title link's target (community actions plan amendment 19.10)", () => {
  it("is at least 44px tall, centred in its row", () => {
    const css = readFileSync(join(process.cwd(), "app/globals.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
    const rule = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].find((match) =>
      match[1].split(",").some((selector) => selector.trim() === ".requests-item-title a"),
    );
    expect(rule).toBeDefined();
    const body = rule![2].replace(/\s+/g, " ");
    expect(body).toMatch(/display:\s*inline-flex/);
    expect(body).toMatch(/align-items:\s*center/);
    expect(body).toMatch(/min-height:\s*44px/);
  });
});

describe("requests that close themselves (stage L spec section 4)", () => {
  const open = own("r-e", "Clip-on lamp", "open");
  const OPEN_UNTIL = { ...open, request: { ...open.request, closesOn: "2026-11-13" } };
  const AUTO = {
    ...own("r-d", "Kettle for res", "closed"),
    closedAt: "2026-10-19T22:00:00.000Z",
    closedAutomatically: true,
    closeReason: "needed-by" as const,
    neededByPassed: true,
  };
  const IDLE = {
    ...own("r-f", "Desk chair", "closed"),
    closedAt: "2026-11-11T22:00:00.000Z",
    closedAutomatically: true,
    closeReason: "idle" as const,
  };

  it("says when an open request will close, and when and why a closed one closed itself, with dates in <time>", () => {
    render(<YourRequestsView items={[OPEN_UNTIL, AUTO, IDLE]} notice={null} />);
    const [first, second, third] = screen.getAllByRole("listitem");
    expect(first).toHaveTextContent("Closes automatically on 13 Nov.");
    expect(first.querySelector('time[datetime="2026-11-13"]')).not.toBeNull();
    expect(second).toHaveTextContent("Closed automatically on 20 Oct, 3 days after the date you needed it by.");
    expect(second.querySelector('time[datetime="2026-10-19T22:00:00.000Z"]')).not.toBeNull();
    expect(third).toHaveTextContent("Closed automatically on 12 Nov, after 30 days with no changes.");
  });

  it("ties a hint to Reopen when reopening takes off a passed needed-by date, and only then", () => {
    render(<YourRequestsView items={[AUTO, IDLE]} notice={null} />);
    expect(screen.getByRole("button", { name: "Reopen Kettle for res" })).toHaveAccessibleDescription(
      "Reopening removes the needed-by date, which has passed.",
    );
    expect(screen.getByRole("button", { name: "Reopen Desk chair" })).not.toHaveAccessibleDescription();
  });

  it("says nothing of closing for a request its asker closed", () => {
    render(<YourRequestsView items={[own("r-b", "Kettle for res", "closed")]} notice={null} />);
    expect(screen.queryByText(/automatically/)).toBeNull();
  });
});
