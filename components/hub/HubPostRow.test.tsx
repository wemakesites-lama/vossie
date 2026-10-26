import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { hubPosts } from "@/data/fixtures/hub";
import { HubPostRow, HubTipRow } from "./HubPostRow";

const first = (kind: string) => hubPosts.find((post) => post.kind === kind)!;

describe("HubPostRow (Launchpad spec 4.2)", () => {
  it("shows an event's kind, title, when, where and how many are going, its title linking to the post", () => {
    const event = first("event");
    const { container } = render(<HubPostRow post={event} campusName="Midrand" />);
    expect(screen.getByText("Event")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: event.title })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: event.title })).toHaveAttribute("href", `/hub/${event.id}`);
    expect(container.querySelector("time")).toHaveAttribute("dateTime", event.startsAt);
    expect(screen.getByText(/ going · /)).toBeInTheDocument();
    expect(container).toHaveTextContent(`${event.place} · Midrand`);
  });

  it("keeps the date block out of the reading order: the time says the date", () => {
    const { container } = render(<HubPostRow post={first("office-hours")} campusName="All campuses" />);
    expect(container.querySelector(".hub-row-date")).toHaveAttribute("aria-hidden", "true");
  });
});

describe("HubTipRow (Launchpad spec 4.3)", () => {
  it("shows a tip's title, date and summary, with no date block", () => {
    const tip = first("tip");
    const { container } = render(<HubTipRow post={tip} />);
    expect(screen.getByRole("link", { name: tip.title })).toHaveAttribute("href", `/hub/${tip.id}`);
    expect(screen.getByText(tip.summary)).toBeInTheDocument();
    expect(container.querySelector(".hub-row-date")).toBeNull();
  });
});
