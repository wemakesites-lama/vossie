import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { getCampuses, getHubPost } from "@/lib/data";
import { HubPostView } from "./HubPostView";

// The request-time parts are tested on their own; here they stand in (jsdom can't render async components in a tree).
vi.mock("./PostAction", () => ({ PostAction: () => <p>Action, stood in</p>, PostActionSkeleton: () => null }));
vi.mock("./UpcomingPosts", () => ({
  UpcomingPosts: () => <section aria-label="More from the Hub, stood in" />,
  UpcomingPostsSkeleton: () => null,
}));

async function show(id: string) {
  const [post, campuses] = await Promise.all([getHubPost(id), getCampuses()]);
  return render(
    <HubPostView post={post!} campusNames={new Map(campuses.map((campus) => [campus.slug, campus.name]))} />,
  );
}

const facts = (container: HTMLElement) =>
  within(container.querySelector<HTMLElement>(".hub-post-facts")!)
    .getAllByRole("listitem")
    .map((item) => item.textContent);

describe("HubPostView (community spec 5.2)", () => {
  it("leads with the breadcrumb, the cover, the kind and the title", async () => {
    const { container } = await show("h-001");
    const crumbs = screen.getByRole("navigation", { name: "Breadcrumb" });
    expect(within(crumbs).getByRole("link", { name: "Hub" })).toHaveAttribute("href", "/hub");
    expect(within(crumbs).getByRole("link", { name: "Back to Events" })).toHaveAttribute("href", "/hub?type=events#hub-feed");
    expect(container.querySelector(".hub-post-cover img")).toHaveAttribute("alt", "");
    expect(screen.getByText("Event")).toHaveClass("eyebrow");
    expect(screen.getByRole("heading", { level: 1, name: "Pitch night" })).toBeInTheDocument();
  });

  it("lists an event's facts, then its body, then the action", async () => {
    const { container } = await show("h-001");
    expect(facts(container)).toEqual([
      "Wed 14 Oct · 18:00",
      "Online, with a watch party at every Hub",
      "All campuses",
      "12 going · 80 places",
    ]);
    expect(screen.getByRole("heading", { level: 2, name: "How the night runs" })).toBeInTheDocument();
    expect(screen.getByText("Action, stood in")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "More from the Hub, stood in" })).toBeInTheDocument();
  });

  it("lists office hours' facts without numbers, under their own crumb", async () => {
    const { container } = await show("h-002");
    const crumbs = screen.getByRole("navigation", { name: "Breadcrumb" });
    expect(within(crumbs).getByRole("link", { name: "Back to Office hours" })).toHaveAttribute(
      "href",
      "/hub?type=office-hours#hub-feed",
    );
    expect(facts(container)).toEqual(["Thu 15 Oct · 13:00", "The Hub, Block C", "Midrand"]);
  });

  it("shows a tip's posted date and its body, with no facts and no action", async () => {
    const { container } = await show("h-013");
    const crumbs = screen.getByRole("navigation", { name: "Breadcrumb" });
    expect(within(crumbs).getByRole("link", { name: "Back to Tips" })).toHaveAttribute("href", "/hub?type=tips#hub-feed");
    expect(screen.getByText(/^Posted/)).toHaveTextContent("Posted 12 October 2026");
    expect(container.querySelector(".hub-post-facts")).toBeNull();
    expect(screen.queryByText("Action, stood in")).toBeNull();
    expect(screen.getByRole("link", { name: "browse what's already listed" })).toHaveAttribute("href", "/browse");
  });
});
