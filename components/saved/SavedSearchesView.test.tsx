import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { SavedSearchItem } from "@/lib/types";
import { SavedSearchesView } from "./SavedSearchesView";

vi.mock("@/lib/saved-searches/actions", () => ({
  deleteSearch: async () => {},
  pauseSearchAlerts: async () => {},
  resumeSearchAlerts: async () => {},
}));

const item = (overrides: Partial<SavedSearchItem> = {}): SavedSearchItem => ({
  id: "ss-1",
  label: "“calculator” at Midrand",
  href: "/browse?q=calculator&campus=midrand",
  savedAt: "2026-10-12T07:40:00Z",
  paused: false,
  ...overrides,
});

const DELETED = { code: "deleted", label: "“calculator” at Midrand", href: "/browse?q=calculator&campus=midrand" } as const;

describe("Saved's Searches tab (search alerts spec 2.7, 2.8 and section 4)", () => {
  it("lists each search with its results, when it was saved, its alerts and its two buttons", () => {
    const tech = item({
      id: "ss-2",
      label: "Tech at every campus",
      href: "/browse?cat=tech&campus=all",
      savedAt: "2026-10-10T09:00:00Z",
      paused: true,
    });
    render(<SavedSearchesView searches={[item(), tech]} notice={null} />);
    expect(screen.getByText("2 saved searches")).toBeInTheDocument();
    const [first, second] = screen.getAllByRole("listitem");
    expect(within(first).getByRole("link", { name: "“calculator” at Midrand" })).toHaveAttribute(
      "href",
      "/browse?q=calculator&campus=midrand",
    );
    expect(within(first).getByText("12 Oct").closest("time")).toHaveAttribute("datetime", "2026-10-12T07:40:00Z");
    expect(within(first).getByText("Alerts on")).toBeInTheDocument();
    expect(within(first).getByRole("button", { name: "Pause alerts for “calculator” at Midrand" })).toHaveAttribute(
      "type",
      "submit",
    );
    expect(within(first).getByRole("button", { name: "Delete saved search “calculator” at Midrand" })).toBeInTheDocument();
    expect([...first.querySelectorAll<HTMLInputElement>('input[name="search"]')].map((input) => input.value)).toEqual([
      "ss-1",
      "ss-1",
    ]);
    expect(within(second).getByText("Paused")).toBeInTheDocument();
    expect(within(second).getByText("10 Oct")).toBeInTheDocument();
    expect(within(second).getByRole("button", { name: "Resume alerts for Tech at every campus" })).toBeInTheDocument();
  });

  it("says what the last press did; Delete's line links to the search's results (spec 2.8)", () => {
    const paused = { ...DELETED, code: "paused" } as const;
    const { unmount } = render(<SavedSearchesView searches={[item({ paused: true })]} notice={paused} />);
    expect(screen.getByRole("status")).toHaveTextContent("Alerts paused for “calculator” at Midrand.");
    unmount();
    const resumed = render(<SavedSearchesView searches={[item()]} notice={{ ...DELETED, code: "resumed" }} />);
    expect(screen.getByRole("status")).toHaveTextContent("Alerts on for “calculator” at Midrand.");
    resumed.unmount();
    render(<SavedSearchesView searches={[]} notice={DELETED} />);
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("Deleted “calculator” at Midrand.");
    expect(within(status).getByRole("link", { name: "“calculator” at Midrand" })).toHaveAttribute(
      "href",
      "/browse?q=calculator&campus=midrand",
    );
  });

  it("says how to save one when there are none", () => {
    render(<SavedSearchesView searches={[]} notice={null} />);
    expect(screen.getByText("No saved searches yet")).toBeInTheDocument();
    expect(screen.getByText("Search on Browse and press Save this search.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Browse" })).toHaveAttribute("href", "/browse");
  });

  it("asks a signed-out visitor to sign in, coming back to the tab", () => {
    render(<SavedSearchesView searches={null} notice={null} />);
    expect(screen.getByText("Sign in to save searches. They'll show here.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/login?next=%2Fsaved%3Ftab%3Dsearches");
  });
});
