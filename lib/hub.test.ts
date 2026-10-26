import { describe, expect, it } from "vitest";
import { hubPosts } from "@/data/fixtures/hub";
import {
  feedKinds,
  feedTypeOf,
  hasPassed,
  hubCampusName,
  hubFeedHref,
  orderHubPosts,
  postDate,
  readHubFeedType,
  toHubEvent,
} from "./hub";

const byId = (id: string) => hubPosts.find((post) => post.id === id)!;
const ids = (posts: readonly { id: string }[]) => posts.map((post) => post.id);

describe("Coming up's tabs (Launchpad spec 4.2)", () => {
  it("reads ?type=, treating anything it doesn't know, and an old tips link, as All", () => {
    expect(readHubFeedType("events")).toBe("events");
    expect(readHubFeedType("office-hours")).toBe("office-hours");
    expect(readHubFeedType(["events", "tips"])).toBe("events");
    expect(readHubFeedType("tips")).toBe("all");
    expect(readHubFeedType("nope")).toBe("all");
    expect(readHubFeedType(undefined)).toBe("all");
  });

  it("links each tab to Coming up, landing on it, and Tips to its section", () => {
    expect(hubFeedHref("all")).toBe("/hub#hub-coming-up");
    expect(hubFeedHref("office-hours")).toBe("/hub?type=office-hours#hub-coming-up");
    expect(hubFeedHref("tips")).toBe("/hub#hub-tips");
  });

  it("knows which kinds each tab shows, and which tab holds each kind", () => {
    expect(feedKinds("all")).toEqual(["event", "office-hours"]);
    expect(feedKinds("events")).toEqual(["event"]);
    expect(feedTypeOf("event")).toBe("events");
    expect(feedTypeOf("office-hours")).toBe("office-hours");
    expect(feedTypeOf("tip")).toBe("tips");
  });
});

describe("a post's date (community spec 5.2, decision 6)", () => {
  it("dates events and office hours in South Africa, and tips not at all", () => {
    expect(postDate({ startsAt: "2026-10-14T22:30:00Z" })).toBe("2026-10-15");
    expect(postDate({ startsAt: null })).toBeNull();
  });

  it("counts an event as passed only from the next day in South Africa (plan decision 10)", () => {
    expect(hasPassed(byId("h-001"), "2026-10-14")).toBe(false);
    expect(hasPassed(byId("h-001"), "2026-10-15")).toBe(true);
    expect(hasPassed(byId("h-013"), "2030-01-01")).toBe(false);
  });
});

describe("orderHubPosts (community spec 5.1)", () => {
  it("puts upcoming events and office hours first, soonest first, then tips, newest first", () => {
    const shuffled = [byId("h-014"), byId("h-003"), byId("h-013"), byId("h-002"), byId("h-011")];
    expect(ids(orderHubPosts(shuffled, "2026-10-12"))).toEqual(["h-002", "h-003", "h-013", "h-014"]);
  });

  it("keeps what's on today, and drops what's past", () => {
    expect(ids(orderHubPosts([byId("h-001"), byId("h-002")], "2026-10-15"))).toEqual(["h-002"]);
    expect(ids(orderHubPosts([byId("h-001"), byId("h-002")], "2026-10-14"))).toEqual(["h-001", "h-002"]);
  });
});

describe("toHubEvent (community spec 5.3)", () => {
  it("turns an event into What's on's row with RSVP, and office hours with Book", () => {
    expect(toHubEvent(byId("h-001"))).toEqual({
      id: "h-001",
      date: "2026-10-14",
      title: "Pitch night",
      campusSlug: "all",
      action: "rsvp",
    });
    expect(toHubEvent(byId("h-004"))).toEqual({
      id: "h-004",
      date: "2026-10-22",
      title: "Photo day for your shop",
      campusSlug: "bedfordview",
      action: "book",
    });
  });

  it("leaves tips out", () => {
    expect(toHubEvent(byId("h-013"))).toBeNull();
  });
});

describe("hubCampusName", () => {
  it("says All campuses for every-campus posts, and the campus's name otherwise", () => {
    const names = new Map([["midrand", "Midrand"]]);
    expect(hubCampusName("all", names)).toBe("All campuses");
    expect(hubCampusName("midrand", names)).toBe("Midrand");
  });
});
