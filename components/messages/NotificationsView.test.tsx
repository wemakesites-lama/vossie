import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ClockIcon, ShieldIcon } from "@/components/icons";
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

  it('says "Nothing new." when there are none (spec 3.5)', () => {
    render(<NotificationsView now={NOW} items={[]} />);
    expect(screen.getByText("Nothing new.")).toBeInTheDocument();
    expect(screen.queryByRole("list")).toBeNull();
  });
});
