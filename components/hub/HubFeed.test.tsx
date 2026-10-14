import { render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HubFeed } from "./HubFeed";

const feed = vi.hoisted(() => ({ mode: "real" as "real" | "no-tips" | "failing" }));

// connection() needs Next's request context, which tests don't have.
vi.mock("next/server", () => ({ connection: async () => undefined }));

vi.mock("@/lib/data", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/data")>();
  return {
    ...actual,
    getHubPosts: async (query: Parameters<typeof actual.getHubPosts>[0]) => {
      if (feed.mode === "failing") throw new Error("The posts didn't load");
      const posts = await actual.getHubPosts(query);
      return feed.mode === "no-tips" ? posts.filter((post) => post.kind !== "tip") : posts;
    },
  };
});

beforeEach(() => {
  // Fake only the date, so "today" is 12 October unless a test sets another time; every sample event is upcoming.
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-12T08:00:00Z"));
});

afterEach(() => {
  feed.mode = "real";
});

const show = async (params: Record<string, string> = {}) =>
  render(await HubFeed({ searchParams: Promise.resolve(params) }));

/** The card titles in one of the feed's lists, in order. */
const titles = (list: string) =>
  within(screen.getByRole("list", { name: list }))
    .getAllByRole("heading", { level: 3 })
    .map((heading) => heading.textContent);

const TIPS = [
  "How to price your first listing",
  "Five phone tricks for better photos",
  "Meeting a buyer safely on campus",
  "Writing a listing people trust",
  "How to get the Verified badge",
  "From side hustle to small business",
];

describe("HubFeed (community spec 5.1)", () => {
  it("shows upcoming events and office hours, soonest first, then tips, newest first", async () => {
    await show();
    expect(titles("Events and office hours")).toEqual([
      "Pitch night",
      "Office hours: pricing your hustle",
      "Market day on the lawn",
      "Photo day for your shop",
      "Hub mixer",
      "Selling online: photos that sell",
      "Office hours: your first listing",
      "End-of-year market",
      "Back-to-campus pop-up",
      "Pitch night",
    ]);
    expect(titles("Tips")).toEqual(TIPS);
    const tabs = screen.getByRole("navigation", { name: "Post types" });
    expect(within(tabs).getAllByRole("link").map((link) => link.textContent)).toEqual([
      "All",
      "Events",
      "Office hours",
      "Tips",
    ]);
    expect(within(tabs).getByRole("link", { name: "All" })).toHaveAttribute("aria-current", "page");
    expect(within(tabs).getByRole("link", { name: "All" })).toHaveAttribute("href", "/hub#hub-feed");
  });

  it("keeps what's on today, until midnight in SAST", async () => {
    vi.setSystemTime(new Date("2026-10-14T21:30:00Z")); // 23:30 on 14 October in South Africa
    await show();
    expect(titles("Events and office hours")[0]).toBe("Pitch night");
  });

  it("drops what has passed", async () => {
    vi.setSystemTime(new Date("2026-10-14T22:30:00Z")); // 00:30 on 15 October in South Africa
    await show();
    const upcoming = titles("Events and office hours");
    expect(upcoming[0]).toBe("Office hours: pricing your hustle");
    expect(upcoming).toHaveLength(9);
  });

  it("narrows to one type from the link, its tab current", async () => {
    await show({ type: "office-hours" });
    const tabs = screen.getByRole("navigation", { name: "Post types" });
    expect(within(tabs).getByRole("link", { name: "Office hours" })).toHaveAttribute("aria-current", "page");
    expect(within(tabs).getByRole("link", { name: "Office hours" })).toHaveAttribute(
      "href",
      "/hub?type=office-hours#hub-feed",
    );
    expect(titles("Office hours")).toEqual([
      "Office hours: pricing your hustle",
      "Photo day for your shop",
      "Office hours: your first listing",
    ]);
    expect(screen.queryByRole("list", { name: "Tips" })).toBeNull();
  });

  it("shows only tips on the Tips tab", async () => {
    await show({ type: "tips" });
    expect(titles("Tips")).toEqual(TIPS);
    expect(screen.queryByRole("list", { name: "Events and office hours" })).toBeNull();
  });

  it("ignores a type it doesn't know", async () => {
    await show({ type: "nope" });
    expect(screen.getByRole("link", { name: "All" })).toHaveAttribute("aria-current", "page");
  });

  it("says when nothing is planned, and still shows the tips", async () => {
    vi.setSystemTime(new Date("2027-03-01T08:00:00Z"));
    await show();
    expect(screen.getByText("Nothing planned right now. Check back soon.")).toBeInTheDocument();
    expect(titles("Tips")).toEqual(TIPS);
  });

  it("says when there are no tips", async () => {
    feed.mode = "no-tips";
    await show({ type: "tips" });
    expect(screen.getByText("No tips yet.")).toBeInTheDocument();
  });

  it("says so when the posts don't load, with a way to try again, and keeps the tabs", async () => {
    feed.mode = "failing";
    await show({ type: "tips" });
    expect(screen.getByText("We couldn't load the Hub's posts just now.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Try again" })).toHaveAttribute("href", "/hub?type=tips#hub-feed");
    expect(screen.getByRole("navigation", { name: "Post types" })).toBeInTheDocument();
  });
});
