import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { getHubPost } from "@/lib/data";
import { HubPostCard } from "./HubPostCard";

async function show(id: string, campusName: string) {
  return render(<HubPostCard post={(await getHubPost(id))!} campusName={campusName} />);
}

describe("HubPostCard (community spec 5.1)", () => {
  it("shows an event's kind, title, day and time in SAST, place, campus and numbers", async () => {
    const { container } = await show("h-001", "All campuses");
    expect(screen.getByText("Event")).toHaveClass("eyebrow");
    expect(screen.getByRole("heading", { level: 3, name: "Pitch night" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Pitch night" })).toHaveAttribute("href", "/hub/h-001");
    expect(container.querySelector("time")).toHaveAttribute("dateTime", "2026-10-14T16:00:00Z");
    expect(container.querySelector("time")).toHaveTextContent("Wed 14 Oct · 18:00");
    expect(screen.getByText("Online, with a watch party at every Hub · All campuses")).toBeInTheDocument();
    expect(screen.getByText("12 going · 80 places")).toBeInTheDocument();
  });

  it("shows office hours without numbers", async () => {
    await show("h-002", "Midrand");
    expect(screen.getByText("Office hours")).toHaveClass("eyebrow");
    expect(screen.getByText("Thu 15 Oct · 13:00")).toBeInTheDocument();
    expect(screen.getByText("The Hub, Block C · Midrand")).toBeInTheDocument();
    expect(screen.queryByText(/going/)).toBeNull();
  });

  it("shows a tip's date and one-line summary", async () => {
    const { container } = await show("h-013", "All campuses");
    expect(screen.getByText("Tip")).toHaveClass("eyebrow");
    expect(container.querySelector("time")).toHaveAttribute("dateTime", "2026-10-12T07:00:00Z");
    expect(container.querySelector("time")).toHaveTextContent("12 Oct");
    expect(
      screen.getByText("Start from what's already listed, add up your costs, and leave room to say yes to a fair offer."),
    ).toBeInTheDocument();
    expect(screen.queryByText(/All campuses/)).toBeNull();
  });

  it("names a tip's campus when it's for one campus, as events do (staff tools plan amendment 34)", async () => {
    const post = { ...(await getHubPost("h-013"))!, campusSlug: "midrand" };
    render(<HubPostCard post={post} campusName="Midrand" />);
    expect(screen.getByText("Midrand")).toHaveClass("hub-card-where");
  });
});
