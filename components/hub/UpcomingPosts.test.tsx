import { render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getCampuses } from "@/lib/data";
import { UpcomingPosts } from "./UpcomingPosts";

const load = vi.hoisted(() => ({ failing: false }));

// connection() needs Next's request context, which tests don't have.
vi.mock("next/server", () => ({ connection: async () => undefined }));

vi.mock("@/lib/data", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/data")>();
  return {
    ...actual,
    getHubPosts: async (query: Parameters<typeof actual.getHubPosts>[0]) => {
      if (load.failing) throw new Error("The posts didn't load");
      return actual.getHubPosts(query);
    },
  };
});

beforeEach(() => {
  // Fake only the date: 12 October, when every sample event is upcoming.
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-12T08:00:00Z"));
});

afterEach(() => {
  load.failing = false;
});

async function show(postId: string) {
  const campuses = await getCampuses();
  return render(
    await UpcomingPosts({ postId, campusNames: new Map(campuses.map((campus) => [campus.slug, campus.name])) }),
  );
}

const hrefs = () =>
  within(screen.getByRole("region", { name: "More from Launchpad" }))
    .getAllByRole("link")
    .map((link) => link.getAttribute("href"));

describe("UpcomingPosts (community spec 5.2)", () => {
  it("offers the next three other events and office hours, as the feed's cards", async () => {
    await show("h-001");
    expect(hrefs()).toEqual(["/hub/h-002", "/hub/h-003", "/hub/h-004"]);
    expect(screen.getAllByRole("heading", { level: 3 }).map((heading) => heading.textContent)).toEqual([
      "Office hours: pricing your hustle",
      "Market day on the lawn",
      "Photo day for your shop",
    ]);
  });

  it("offers events under a tip too, never tips", async () => {
    await show("h-013");
    expect(hrefs()).toEqual(["/hub/h-001", "/hub/h-002", "/hub/h-003"]);
  });

  it("hides when nothing else is planned", async () => {
    vi.setSystemTime(new Date("2027-03-01T08:00:00Z"));
    const { container } = await show("h-013");
    expect(container).toBeEmptyDOMElement();
  });

  it("shows its own error, with a way back to this post", async () => {
    load.failing = true;
    await show("h-001");
    expect(screen.getByRole("link", { name: "Try again" })).toHaveAttribute(
      "href",
      "/hub/h-001?retry=hub-upcoming#hub-upcoming",
    );
  });
});
