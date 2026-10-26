import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { answerBooking, listBookings, listPostsForStaff } from "@/lib/data/hub-posts";
import { resetSampleStore, sampleStore } from "@/lib/data/store";
import { HubManage } from "./HubManage";

vi.mock("@/lib/staff/hub-actions", () => ({ answerSlot: async () => {} }));

const names = new Map([["midrand", "Midrand"]]);

beforeEach(() => {
  resetSampleStore();
});

describe("the Hub's list and queue (staff tools spec 2.4 and 3)", () => {
  it("lists a mentor's own posts, each with Edit naming it, and Write a post", async () => {
    const posts = (await listPostsForStaff()).filter((post) => post.authorId === "acc-mentor");
    render(<HubManage posts={posts} everyPost={false} bookings={[]} campusNames={names} />);
    expect(screen.getByRole("link", { name: "Write a post" })).toHaveAttribute("href", "/hub/new");
    const table = screen.getByRole("table", { name: "Your posts, most recently changed first" });
    expect(within(table).getAllByRole("row")).toHaveLength(4);
    expect(within(table).getByRole("link", { name: "Edit Office hours: pricing your hustle" })).toHaveAttribute(
      "href",
      "/hub/h-002/edit",
    );
    expect(within(table).getAllByRole("cell", { name: "Published" })).toHaveLength(3);
  });

  it("says every post for an admin, with a draft marked and a post with no date saying so", async () => {
    sampleStore().hubPosts.get("h-013")!.published = false;
    const posts = await listPostsForStaff();
    render(<HubManage posts={posts} everyPost={true} bookings={[]} campusNames={names} />);
    const table = screen.getByRole("table", { name: "Every post, most recently changed first" });
    expect(within(table).getAllByRole("row")).toHaveLength(23);
    const draft = within(table).getByRole("row", { name: /How to price your first listing/ });
    expect(within(draft).getByRole("cell", { name: "Draft" })).toBeInTheDocument();
    expect(within(draft).getByRole("cell", { name: "No date" })).toBeInTheDocument();
    expect(within(draft).getByRole("cell", { name: "All campuses" })).toBeInTheDocument();
    // A sample post has no author of its own, and a mentor's names her.
    expect(within(draft).getByRole("cell", { name: "The Hub" })).toBeInTheDocument();
    expect(within(table).getByRole("row", { name: /Office hours: pricing your hustle/ })).toHaveTextContent("Naledi");
  });

  it("lists slot requests, open first, with Accept and Decline naming the student and the office hours", async () => {
    render(<HubManage posts={[]} everyPost={true} bookings={await listBookings()} campusNames={names} />);
    const queue = screen.getByRole("region", { name: "Office-hours requests" });
    expect(queue).toHaveAttribute("id", "hub-queue");
    const accept = within(queue).getByRole("button", {
      name: "Accept Thandi's request for Office hours: your first listing",
    });
    expect(accept.closest("form")?.querySelector('input[name="answer"]')).toHaveValue("accepted");
    expect(accept.closest("form")?.querySelector('input[name="booking"]')).toHaveValue("bk-s1");
    expect(
      within(queue).getByRole("button", { name: "Decline Thandi's request for Office hours: your first listing" }),
    ).toBeInTheDocument();
    expect(within(queue).getByText(/write the listing or what to charge/)).toBeInTheDocument();
    expect(within(queue).getByRole("cell", { name: "Any time after 13:30" })).toBeInTheDocument();
    expect(screen.getByText("No posts yet.")).toBeInTheDocument();
  });

  it("shows an answered request's answer instead of its buttons", async () => {
    await answerBooking("bk-s1", "accepted", "acc-mentor", new Date("2026-10-14T08:42:00.000Z"));
    render(<HubManage posts={[]} everyPost={true} bookings={await listBookings()} campusNames={names} />);
    const queue = screen.getByRole("region", { name: "Office-hours requests" });
    expect(within(queue).getByRole("cell", { name: "Accepted" })).toBeInTheDocument();
    expect(within(queue).queryByRole("button")).toBeNull();
  });

  it("says when no one has asked", () => {
    render(<HubManage posts={[]} everyPost={false} bookings={[]} campusNames={names} />);
    expect(screen.getByText("No slot requests yet.")).toBeInTheDocument();
  });
});
