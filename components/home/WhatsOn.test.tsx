import { render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WhatsOnEvents } from "./WhatsOn";

const viewer = vi.hoisted(() => ({ campus: "midrand" }));
const events = vi.hoisted(() => ({ mode: "real" as "real" | "empty" | "failing" }));

vi.mock("@/lib/data/viewer", () => ({
  getViewerContext: async () => ({ campus: viewer.campus, signedIn: false, activity: null }),
}));

vi.mock("@/lib/data", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/data")>();
  return {
    ...actual,
    getHubEvents: async (query: Parameters<typeof actual.getHubEvents>[0]) => {
      if (events.mode === "failing") throw new Error("The events didn't load");
      return events.mode === "empty" ? [] : actual.getHubEvents(query);
    },
  };
});

afterEach(() => {
  events.mode = "real";
});

describe("WhatsOnEvents (spec 7.13)", () => {
  it("lists the campus's next three events with a date block and an action", async () => {
    viewer.campus = "midrand";
    const { container } = render(await WhatsOnEvents());
    const rows = screen.getAllByRole("listitem");
    expect(rows).toHaveLength(3);
    expect(within(rows[0]).getByText("Pitch night")).toBeInTheDocument();
    expect(within(rows[0]).getByText("All campuses")).toBeInTheDocument();
    expect(within(rows[1]).getByText("Midrand")).toBeInTheDocument();
    expect(container.querySelector("time")).toHaveAttribute("dateTime", "2026-10-14");
    expect(container.querySelector("time")).toHaveTextContent("14Oct");
    expect(within(rows[0]).getByRole("link", { name: "RSVP for Pitch night" })).toHaveAttribute("href", "/hub");
    expect(within(rows[1]).getByRole("link", { name: "Book for Office hours: pricing your hustle" })).toBeInTheDocument();
  });

  it("says when nothing is on, and points to the Hub", async () => {
    events.mode = "empty";
    render(await WhatsOnEvents());
    expect(screen.getByText(/No events this week/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "See what the Hub is planning" })).toHaveAttribute("href", "/hub");
  });

  it("shows its own error state when the events don't load", async () => {
    events.mode = "failing";
    render(await WhatsOnEvents());
    expect(screen.getByText("What’s on didn't load.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Try again" })).toHaveAttribute("href", "/?retry=whats-on#whats-on");
  });
});
