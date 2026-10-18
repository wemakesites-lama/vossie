import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getHubPost } from "@/lib/data";
import { addRsvp } from "@/lib/data/hub-posts";
import { resetSampleStore, sampleStore } from "@/lib/data/store";
import { PostAction } from "./PostAction";

const viewer = vi.hoisted(() => ({ id: null as string | null }));

// connection() needs Next's request context, which tests don't have.
vi.mock("next/server", () => ({ connection: async () => undefined }));
// The session is the sample account named here; the store is the real sample store.
vi.mock("@/lib/auth/session", async () => {
  const { getAccount } = await import("@/lib/data/accounts");
  return { getViewer: async () => (viewer.id ? getAccount(viewer.id) : null), getSessionKey: async () => null };
});
// The forms only need something to post to; the actions have their own tests.
vi.mock("@/lib/hub-actions", () => ({ rsvpToEvent: async () => {}, cancelRsvp: async () => {} }));

beforeEach(() => {
  resetSampleStore();
  viewer.id = null;
});

/** Fake only the date: "now" is the given time. */
function now(iso: string) {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(iso));
}

async function show(id: string) {
  return render(await PostAction({ post: (await getHubPost(id))! }));
}

describe("PostAction, signed out (community spec 5.2, decision 6)", () => {
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
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("offers Request a slot through sign-in to its request page, with a note for the mentor (staff tools spec 2.5)", async () => {
    now("2026-10-12T08:00:00Z");
    await show("h-002");
    expect(screen.getByRole("link", { name: "Request a slot" })).toHaveAttribute(
      "href",
      "/login?next=%2Fhub%2Fh-002%2Fbook",
    );
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

describe("PostAction, signed in (staff tools spec 2.5, plan decision 13)", () => {
  it("gives RSVP as a button, then You're going with Cancel my RSVP", async () => {
    now("2026-10-12T08:00:00Z");
    viewer.id = "acc-student";
    const first = await show("h-001");
    expect(screen.getByRole("button", { name: "RSVP" })).toHaveAttribute("type", "submit");
    expect(document.querySelector('input[name="post"]')).toHaveValue("h-001");
    first.unmount();
    await addRsvp("h-001", "acc-student", "2026-10-12", new Date());
    await show("h-001");
    expect(screen.getByText("You're going")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel my RSVP" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "RSVP" })).toBeNull();
  });

  it("says a full event is full, with no button", async () => {
    now("2026-10-12T08:00:00Z");
    viewer.id = "acc-student";
    sampleStore().hubPosts.get("h-003")!.going = 40;
    await show("h-003");
    expect(screen.getByText("This event is full.")).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("links office hours to their request page, or says where the student's request stands", async () => {
    now("2026-10-12T08:00:00Z");
    viewer.id = "acc-seller";
    const first = await show("h-002");
    expect(screen.getByRole("link", { name: "Request a slot" })).toHaveAttribute("href", "/hub/h-002/book");
    expect(screen.getByText("Tell the mentor what you'd like help with.")).toBeInTheDocument();
    first.unmount();
    viewer.id = "acc-student";
    await show("h-007");
    expect(screen.getByText("Your request is waiting for a mentor.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "See your request" })).toHaveAttribute("href", "/hub/h-007/book");
  });
});
