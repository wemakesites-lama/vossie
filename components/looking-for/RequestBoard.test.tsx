import { render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetSampleStore } from "@/lib/data/store";
import { RequestBoard } from "./RequestBoard";

const viewer = vi.hoisted(() => ({ campus: "all", signedIn: false }));
const board = vi.hoisted(() => ({ failing: false }));

// Post a request's session part is an async Server Component; here it follows `viewer.signedIn` (plan, Task 16).
vi.mock("@/components/looking-for/ViewerPostRequestLink", async () =>
  (await import("@/tests/helpers/viewer-post-request")).viewerPostRequestLink(() => viewer.signedIn),
);

vi.mock("@/lib/data/viewer", () => ({
  getViewerContext: async () => ({ campus: viewer.campus, signedIn: false, activity: null }),
}));

vi.mock("@/lib/data", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/data")>();
  return {
    ...actual,
    getOpenRequests: async (query: Parameters<typeof actual.getOpenRequests>[0]) => {
      if (board.failing) throw new Error("The requests didn't load");
      return actual.getOpenRequests(query);
    },
  };
});

// Requests come from the sample store (community actions plan decision 1). A fresh one for each test.
beforeEach(() => {
  resetSampleStore();
});

afterEach(() => {
  viewer.campus = "all";
  viewer.signedIn = false;
  board.failing = false;
});

const show = async (params: Record<string, string> = {}) =>
  render(await RequestBoard({ searchParams: Promise.resolve(params) }));

/** The request titles in one of the board's sections, in order. */
const titles = (section: string) =>
  within(screen.getByRole("region", { name: section }))
    .getAllByRole("heading", { level: 3 })
    .map((heading) => heading.textContent);

describe("RequestBoard (community spec 4.1)", () => {
  it("lists every open request, newest first, under one heading when no campus is chosen", async () => {
    await show();
    const all = titles("Open requests");
    expect(all).toHaveLength(14);
    expect(all[0]).toBe("Accounting 1 tutor this week");
    expect(all).not.toContain("Kettle for res");
    expect(screen.queryByRole("region", { name: "Other campuses" })).toBeNull();
  });

  it("puts the viewer's campus first, then every other campus", async () => {
    viewer.campus = "midrand";
    await show();
    expect(titles("At Midrand")).toEqual(["Accounting 1 tutor this week", "Birthday cake for Friday"]);
    expect(titles("Other campuses")).toHaveLength(12);
  });

  it("says when the viewer's campus has none, and still shows the rest", async () => {
    viewer.campus = "mbombela";
    await show();
    const own = screen.getByRole("region", { name: "At Mbombela" });
    expect(within(own).getByText("Nothing at Mbombela yet.")).toBeInTheDocument();
    expect(titles("Other campuses")).toHaveLength(14);
  });

  it("heads the list \"On Eduvos Online\" for the online campus, which has no ground to be \"At\"", async () => {
    viewer.campus = "online";
    await show();
    expect(titles("On Eduvos Online")).toEqual(["Business Law 2 notes"]);
    expect(screen.queryByRole("region", { name: "At Eduvos Online" })).toBeNull();
    expect(titles("Other campuses")).toHaveLength(13);
    expect(screen.queryByText(/Nothing (at|on) /)).toBeNull();
  });

  it("says \"Nothing on Eduvos Online yet.\" when the online campus has none in the category", async () => {
    viewer.campus = "online";
    await show({ cat: "tech" });
    const own = screen.getByRole("region", { name: "On Eduvos Online" });
    expect(within(own).getByText("Nothing on Eduvos Online yet.")).toBeInTheDocument();
    expect(screen.queryByText(/Nothing at Eduvos Online/)).toBeNull();
    expect(titles("Other campuses")).toEqual(["Graphic calculator to borrow for exams", "Laptop charger, Lenovo 65W"]);
  });

  it("says so when the campus has none only because of the category, and Other campuses still follows", async () => {
    viewer.campus = "midrand";
    await show({ cat: "tech" });
    // Midrand has open requests (tutoring and food), just none in Tech.
    const own = screen.getByRole("region", { name: "At Midrand" });
    expect(within(own).getByText("Nothing at Midrand yet.")).toBeInTheDocument();
    expect(within(own).queryByRole("heading", { level: 3 })).toBeNull();
    expect(titles("Other campuses")).toEqual(["Graphic calculator to borrow for exams", "Laptop charger, Lenovo 65W"]);
    // The own section comes first, then Other campuses.
    const regions = screen.getAllByRole("region").map((region) => region.getAttribute("aria-labelledby"));
    expect(regions).toEqual(["board-own-title", "board-others-title"]);
  });

  it("narrows to the category in the link, its chip current", async () => {
    await show({ cat: "tech" });
    const chips = screen.getByRole("navigation", { name: "Categories" });
    expect(within(chips).getAllByRole("link")).toHaveLength(11);
    expect(within(chips).getByRole("link", { name: "Tech" })).toHaveAttribute("aria-current", "page");
    expect(within(chips).getByRole("link", { name: "Tech" })).toHaveAttribute("href", "/looking-for?cat=tech");
    expect(within(chips).getByRole("link", { name: "All" })).toHaveAttribute("href", "/looking-for");
    expect(titles("Open requests")).toEqual(["Graphic calculator to borrow for exams", "Laptop charger, Lenovo 65W"]);
  });

  it("ignores a category it doesn't know", async () => {
    await show({ cat: "nope" });
    expect(screen.getByRole("link", { name: "All" })).toHaveAttribute("aria-current", "page");
    expect(titles("Open requests")).toHaveLength(14);
  });

  it("invites the first request when a category has nothing open", async () => {
    await show({ cat: "tickets-events" });
    expect(screen.getByText("No requests here yet. Be the first to ask.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Post a request" })).toHaveAttribute(
      "href",
      "/login?next=%2Flooking-for%2Fnew",
    );
    expect(screen.queryByRole("region")).toBeNull();
  });

  it("opens the request form itself from the empty state once the visitor is signed in", async () => {
    viewer.signedIn = true;
    await show({ cat: "tickets-events" });
    expect(screen.getByRole("link", { name: "Post a request" })).toHaveAttribute("href", "/looking-for/new");
  });

  it("says so when the requests don't load, with a way to try again, and keeps the chips", async () => {
    board.failing = true;
    await show({ cat: "food" });
    expect(screen.getByText("We couldn't load requests just now.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Try again" })).toHaveAttribute("href", "/looking-for?cat=food");
    expect(screen.getByRole("navigation", { name: "Categories" })).toBeInTheDocument();
  });
});
