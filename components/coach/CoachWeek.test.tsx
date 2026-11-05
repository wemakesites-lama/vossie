import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { prefetchingLinks } from "@/tests/helpers/next-link";
import type { CoachView } from "@/lib/coach/this-week";
import { CoachWeek, NOTHING_TO_DO } from "./CoachWeek";

vi.mock("next/link", async () => (await import("@/tests/helpers/next-link")).nextLinkShowingPrefetch);
vi.mock("@/lib/coach/actions", () => ({ tickCoachAction: async () => {} }));

const item = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  kind: "read-tip",
  target: { type: "post", id: "hp-1" },
  name: "A tip",
  evidence: {},
  href: `/hub/${id}`,
  title: "Read: A tip",
  why: "A short tip.",
  asOf: "2026-10-14T10:00:00.000Z",
  state: "open",
  tick: null,
  ...over,
});

const VIEW = {
  week: "2026-10-12",
  items: [
    item("add-photos:l-1", { kind: "add-photos", title: "Add photos to Casio", why: "It has one photo.", state: "done" }),
    item("read-tip:hp-1", { tick: "mark-done" }),
    item("answer-request:r-1", { kind: "answer-request", title: "Answer a request", why: "Someone wants it.", state: "gone" }),
  ],
  progress: { done: 1, total: 2 },
  lastWeek: "Last week: 2 of 3 done",
} as unknown as CoachView;

describe("the Coach card (AI stage I1, Task 9)", () => {
  it("is a region named This week, with each title linking to its href and its why", () => {
    render(<CoachWeek view={VIEW} from="sell" />);
    const region = screen.getByRole("region", { name: "This week" });
    expect(within(region).getByRole("link", { name: "Add photos to Casio" })).toHaveAttribute("href", "/hub/add-photos:l-1");
    expect(within(region).getByText("It has one photo.")).toBeInTheDocument();
    expect(within(region).getByText("Someone wants it.")).toBeInTheDocument();
  });

  it("says Done and No longer needed in words, and counts them", () => {
    render(<CoachWeek view={VIEW} from="sell" />);
    expect(screen.getByText("Done")).toBeInTheDocument();
    expect(screen.getByText("No longer needed")).toBeInTheDocument();
    expect(screen.getByText("1 of 2 done")).toBeInTheDocument();
    expect(screen.getByText("Last week: 2 of 3 done")).toBeInTheDocument();
  });

  it("gives Mark done a distinct name and a form with hidden action and from fields", () => {
    const { container } = render(<CoachWeek view={VIEW} from="sell" />);
    const button = screen.getByRole("button", { name: "Mark done: Read: A tip" });
    expect(button).toHaveAttribute("type", "submit");
    const form = button.closest("form")!;
    expect(form.querySelector('input[name="action"]')).toHaveValue("read-tip:hp-1");
    expect(form.querySelector('input[name="from"]')).toHaveValue("sell");
    expect(prefetchingLinks(container)).toEqual([]);
  });

  it("says nothing to do with no items, beside the last week line", () => {
    render(<CoachWeek view={{ ...VIEW, items: [], progress: { done: 0, total: 0 } }} from="sell" />);
    expect(screen.getByText(NOTHING_TO_DO)).toBeInTheDocument();
    expect(screen.getByText("Last week: 2 of 3 done")).toBeInTheDocument();
    expect(screen.queryByRole("list")).toBeNull();
    expect(screen.queryByText("0 of 0 done")).toBeNull();
  });

  it("is Your week on the Launchpad and posts from=hub", () => {
    render(<CoachWeek view={VIEW} from="hub" />);
    expect(screen.getByRole("region", { name: "Your week" })).toBeInTheDocument();
    const form = screen.getByRole("button", { name: /^Mark done/ }).closest("form")!;
    expect(form.querySelector('input[name="from"]')).toHaveValue("hub");
  });
});
