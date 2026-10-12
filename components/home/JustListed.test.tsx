import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { JustListedContent, JustListedSkeleton } from "./JustListed";
import { JustListedViews } from "./JustListedViews";

const viewer = vi.hoisted(() => ({ campus: "midrand" }));
const listings = vi.hoisted(() => ({ mode: "ok" as "ok" | "failing" | "empty" }));

vi.mock("@/lib/data/viewer", () => ({
  getViewerContext: async () => ({ campus: viewer.campus, signedIn: false, activity: null }),
}));

vi.mock("@/lib/data", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/data")>();
  return {
    ...actual,
    getJustListed: async (query: Parameters<typeof actual.getJustListed>[0]) => {
      if (listings.mode === "failing") throw new Error("The listings didn't load");
      return listings.mode === "empty" ? [] : actual.getJustListed(query);
    },
  };
});

afterEach(() => {
  listings.mode = "ok";
});

const heading = () => screen.getByRole("heading", { level: 2 });
const firstLink = (card: HTMLElement) => within(card).getByRole("link");

describe("Just listed (spec 7.8)", () => {
  it("shows the newest at the chosen campus, with a switch to every campus", async () => {
    viewer.campus = "midrand";
    render(await JustListedContent());
    expect(heading()).toHaveTextContent("New at Midrand");
    const cards = screen.getAllByRole("article");
    expect(cards).toHaveLength(10);
    expect(firstLink(cards[0])).toHaveAttribute("href", "/listings/l-001");
    const campusButton = screen.getByRole("button", { name: "Midrand" });
    expect(campusButton).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(screen.getByRole("button", { name: "All campuses" }));
    expect(heading()).toHaveTextContent("New on all campuses");
    expect(campusButton).toHaveAttribute("aria-pressed", "false");
    expect(firstLink(screen.getAllByRole("article")[1])).toHaveAttribute("href", "/listings/l-018");
  });

  it("has no switch when the visitor shops every campus", async () => {
    viewer.campus = "all";
    render(await JustListedContent());
    expect(heading()).toHaveTextContent("New on all campuses");
    expect(screen.queryByRole("group", { name: "Show new listings from" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "See all new listings" })).toHaveAttribute("href", "/browse");
  });

  it("offers every campus when the chosen one has nothing new, and keeps focus on the heading", async () => {
    viewer.campus = "mbombela";
    render(await JustListedContent());
    expect(screen.getByText("Nothing new at Mbombela yet")).toBeInTheDocument();
    expect(screen.queryByRole("article")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Show all campuses" }));
    expect(heading()).toHaveTextContent("New on all campuses");
    expect(heading()).toHaveFocus();
    expect(screen.getAllByRole("article")).toHaveLength(10);
  });

  it("goes back to the campus view whenever the campus changes, even back to an earlier one", () => {
    const campusView = <p>Campus grid</p>;
    const allView = <p>All grid</p>;
    const link = { href: "/browse", label: "See all" };
    const views = (campusName: string) => (
      <JustListedViews campusName={campusName} campusCount={1} campusView={campusView} allView={allView} link={link} />
    );
    const { rerender } = render(views("Midrand"));
    fireEvent.click(screen.getByRole("button", { name: "All campuses" }));
    expect(screen.getByText("All grid")).toBeInTheDocument();
    rerender(views("Pretoria"));
    expect(screen.getByText("Campus grid")).toBeInTheDocument();
    rerender(views("Midrand"));
    expect(screen.getByText("Campus grid")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("New at Midrand");
  });

  it("says saves stay on this device for now", async () => {
    viewer.campus = "all";
    render(await JustListedContent());
    expect(screen.getByText(/Hearts save to this device for now/)).toBeInTheDocument();
  });

  it("shows its own error state when the listings don't load", async () => {
    viewer.campus = "midrand";
    listings.mode = "failing";
    render(await JustListedContent());
    expect(heading()).toHaveTextContent("New listings");
    expect(screen.getByText("Just listed didn't load.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Try again" })).toHaveAttribute("href", "/?retry=just-listed#just-listed");
  });

  it("says so when nothing is new on any campus, instead of an empty grid", async () => {
    viewer.campus = "all";
    listings.mode = "empty";
    render(await JustListedContent());
    expect(heading()).toHaveTextContent("New on all campuses");
    expect(screen.getByText("No new listings yet. Check back soon.")).toBeInTheDocument();
    expect(screen.queryByRole("article")).not.toBeInTheDocument();
  });

  it("keeps its heading and card shapes while it streams in", () => {
    const { container } = render(<JustListedSkeleton />);
    expect(heading()).toHaveTextContent("New listings");
    expect(container.querySelectorAll(".listing-grid > li")).toHaveLength(10);
  });
});
