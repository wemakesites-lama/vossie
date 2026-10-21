import { render, screen, within } from "@testing-library/react";
import type { ReactElement } from "react";
import { describe, expect, it } from "vitest";
import { ClockIcon, FlagIcon, MessageIcon, PlusSquareIcon, ShieldIcon } from "@/components/icons";
import type { NotificationItem } from "@/lib/types";
import { NotificationsView } from "./NotificationsView";

// Wednesday 14 October 2026, 15:00 in South Africa.
const NOW = new Date("2026-10-14T13:00:00Z");

const item = (overrides: Partial<NotificationItem>): NotificationItem => ({
  id: "note-1",
  kind: "message",
  text: "Tech corner replied about Casio fx-991ZA Plus calculator",
  href: "/messages/conv-1",
  createdAt: "2026-10-14T12:05:00Z",
  isNew: true,
  ...overrides,
});

describe("notifications (messaging spec 3.5)", () => {
  it("lists each as a link to the thing, with its sentence, the time, and New when it's new", () => {
    render(
      <NotificationsView
        now={NOW}
        items={[
          item({}),
          item({
            id: "note-2",
            kind: "sale-to-confirm",
            text: "Tech corner marked Casio fx-991ZA Plus calculator as done. Did the sale happen?",
            href: "/messages/conv-2",
            createdAt: "2026-10-12T08:00:00Z",
            isNew: false,
          }),
        ]}
      />,
    );
    const rows = screen.getAllByRole("listitem");
    expect(within(rows[0]).getByRole("link")).toHaveAttribute("href", "/messages/conv-1");
    expect(within(rows[0]).getByText("New")).toHaveClass("notes-new");
    expect(within(rows[0]).getByText("Tech corner replied about Casio fx-991ZA Plus calculator")).toBeInTheDocument();
    expect(within(rows[0]).getByText("14:05")).toHaveAttribute("datetime", "2026-10-14T12:05:00Z");
    expect(within(rows[1]).getByRole("link")).toHaveAttribute("href", "/messages/conv-2");
    expect(within(rows[1]).queryByText("New")).toBeNull();
    expect(within(rows[1]).getByText("Mon")).toBeInTheDocument();
  });

  it("gives every kind an icon, hidden from screen readers (plan decision 13)", () => {
    const { container } = render(
      <NotificationsView
        now={NOW}
        items={(["message", "sale-to-confirm", "report-handled", "shop-approved", "shop-update", "booking"] as const).map(
          (kind, n) => item({ id: `note-${n}`, kind, text: `Sentence ${n}` }),
        )}
      />,
    );
    const icons = container.querySelectorAll("svg.notes-icon");
    expect(icons).toHaveLength(6);
    for (const icon of icons) expect(icon).toHaveAttribute("aria-hidden", "true");
  });

  it("draws a shop update with the shield and a slot request or answer with the clock (staff tools plan decision 7)", () => {
    const drawn = (kind: NotificationItem["kind"]) =>
      render(<NotificationsView now={NOW} items={[item({ kind })]} />).container.querySelector("svg.notes-icon")!.innerHTML;
    const shield = render(<ShieldIcon className="notes-icon" />).container.querySelector("svg")!.innerHTML;
    const clock = render(<ClockIcon className="notes-icon" />).container.querySelector("svg")!.innerHTML;
    expect(drawn("shop-update")).toBe(shield);
    expect(drawn("booking")).toBe(clock);
    expect(shield).not.toBe(clock);
  });

  it("draws an icon for an offer, a request's update and a followed shop's new listing (community actions plan decision 14)", () => {
    const { container } = render(
      <NotificationsView
        now={NOW}
        items={(["offer", "request-update", "new-listing"] as const).map((kind, n) =>
          item({ id: `note-${n}`, kind, text: `Note ${n}` }),
        )}
      />,
    );
    expect(container.querySelectorAll(".notes-row .notes-icon")).toHaveLength(3);
  });

  it("draws an offer with the speech bubble, a request's update with the flag and a new listing with the plus-square", () => {
    const drawn = (kind: NotificationItem["kind"]) =>
      render(<NotificationsView now={NOW} items={[item({ kind })]} />).container.querySelector("svg.notes-icon")!.innerHTML;
    const inner = (icon: ReactElement) => render(icon).container.querySelector("svg")!.innerHTML;
    const bubble = inner(<MessageIcon className="notes-icon" />);
    const flag = inner(<FlagIcon className="notes-icon" />);
    const plus = inner(<PlusSquareIcon className="notes-icon" />);
    expect(drawn("offer")).toBe(bubble);
    expect(drawn("request-update")).toBe(flag);
    expect(drawn("new-listing")).toBe(plus);
    expect(new Set([bubble, flag, plus]).size).toBe(3);
  });

  it('says "Nothing new." when there are none (spec 3.5)', () => {
    render(<NotificationsView now={NOW} items={[]} />);
    expect(screen.getByText("Nothing new.")).toBeInTheDocument();
    expect(screen.queryByRole("list")).toBeNull();
  });
});

describe("a saved search's matches (search alerts spec 2.12 and section 4)", () => {
  it("draws the search icon, decorative, beside the sentence, and leads to the results", () => {
    const { container } = render(
      <NotificationsView
        now={NOW}
        items={[
          item({
            id: "note-ss",
            kind: "search-match",
            text: "3 new listings match your search “calculator” at Midrand",
            href: "/browse?q=calculator&campus=midrand&sort=new",
          }),
        ]}
      />,
    );
    const icon = container.querySelector(".notes-row svg.notes-icon");
    expect(icon).toHaveAttribute("aria-hidden", "true");
    expect(icon?.querySelector("circle")).not.toBeNull();
    expect(icon?.querySelector("path")).toHaveAttribute("d", "m16 16 4.5 4.5");
    expect(screen.getByRole("link", { name: /3 new listings match your search “calculator” at Midrand/ })).toHaveAttribute(
      "href",
      "/browse?q=calculator&campus=midrand&sort=new",
    );
  });
});

describe("a staff role given or taken away (stage J spec decision 7)", () => {
  it("draws it with the shield, hidden from screen readers", () => {
    const { container } = render(
      <NotificationsView
        now={NOW}
        items={[item({ kind: "staff-role", text: "You're a CampusCart mentor now.", href: "/account" })]}
      />,
    );
    const icon = container.querySelector("svg.notes-icon")!;
    const shield = render(<ShieldIcon className="notes-icon" />).container.querySelector("svg")!;
    expect(icon.innerHTML).toBe(shield.innerHTML);
    expect(icon).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByRole("link", { name: /You're a CampusCart mentor now\./ })).toHaveAttribute("href", "/account");
  });
});
