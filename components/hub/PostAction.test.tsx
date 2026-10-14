import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { getHubPost } from "@/lib/data";
import { PostAction } from "./PostAction";

// connection() needs Next's request context, which tests don't have.
vi.mock("next/server", () => ({ connection: async () => undefined }));

/** Fake only the date: "now" is the given time. */
function now(iso: string) {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(iso));
}

async function show(id: string) {
  return render(await PostAction({ post: (await getHubPost(id))! }));
}

describe("PostAction (community spec 5.2, decision 6)", () => {
  it("offers RSVP through the sign-in page, until midnight on the event's day in SAST", async () => {
    now("2026-10-14T21:30:00Z"); // 23:30 on the day, in South Africa
    await show("h-001");
    expect(screen.getByRole("link", { name: "RSVP" })).toHaveAttribute("href", "/login?next=%2Fhub%2Fh-001");
  });

  it("says an event has passed from the next day, with no button", async () => {
    now("2026-10-14T22:30:00Z"); // 00:30 the next day, in South Africa
    await show("h-001");
    expect(screen.getByText("This event has passed")).toBeInTheDocument();
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("offers Request a slot for office hours, with a note for the mentor", async () => {
    now("2026-10-12T08:00:00Z");
    await show("h-002");
    expect(screen.getByRole("link", { name: "Request a slot" })).toHaveAttribute("href", "/login?next=%2Fhub%2Fh-002");
    expect(screen.getByText("Tell the mentor what you'd like help with when you sign in.")).toBeInTheDocument();
  });

  it("says office hours have passed, with no button and no note", async () => {
    now("2026-10-12T08:00:00Z");
    await show("h-012");
    expect(screen.getByText("These office hours have passed")).toBeInTheDocument();
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.queryByText(/Tell the mentor/)).toBeNull();
  });

  it("keeps the room for the tallest state of each kind", async () => {
    now("2026-10-12T08:00:00Z");
    const { container, unmount } = await show("h-012");
    expect(container.querySelector(".hub-post-action")).toHaveAttribute("data-kind", "office-hours");
    unmount();
    const event = await show("h-001");
    expect(event.container.querySelector(".hub-post-action")).not.toHaveAttribute("data-kind");
  });
});
