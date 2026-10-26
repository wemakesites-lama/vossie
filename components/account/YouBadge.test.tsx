import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RoleTabs } from "@/components/tabbar/TabBar";
import { forYouItems, forYouTotal } from "@/lib/you/model";
import { YouView } from "./AccountView";

const parts = vi.hoisted(() => ({
  // Three unread conversations, one of them the offer's thread: the messages row counts 2 (plan decision 1).
  conversations: 3,
  byKind: {
    offer: { count: 1, newestHref: "/messages/conv-9", newestText: "Tech corner offered" },
    "search-match": { count: 3, newestHref: "/browse", newestText: "Matches" },
    "new-listing": { count: 1, newestHref: "/listings/l-001", newestText: "Tech corner listed a kettle" },
  },
}));

vi.mock("@/lib/auth/session", () => ({ getViewer: async () => ({ id: "acc-student", roles: [], seller: null }) }));
vi.mock("@/lib/you/read", async () => {
  const { forYouItems: items } = await import("@/lib/you/model");
  return { readForYou: async () => ({ items: items(parts), conversations: parts.conversations, newNotifications: 9 }) };
});

describe("the You tab's badge equals For you's list (role views spec 4.2)", () => {
  it("shows the sum of the rows the page lists", async () => {
    const forYou = { items: forYouItems(parts), conversations: parts.conversations, newNotifications: 9 };
    const tab = render(<ul>{await RoleTabs()}</ul>);
    const badge = Number.parseInt(screen.getByRole("link", { name: "You" }).querySelector(".hdr-badge")!.textContent!, 10);
    tab.unmount();

    render(
      <YouView
        account={{ id: "acc-student", email: "s@eduvos.com", firstName: "Thandi", campusSlug: "midrand", roles: [], seller: null, createdAt: "2026-09-01T07:30:00.000Z" }}
        campusName="Midrand"
        forYou={forYou}
        stuff={null}
      />,
    );
    const listed = [...document.querySelectorAll(".needs-count")].reduce((sum, el) => sum + Number(el.textContent), 0);
    expect(badge).toBe(7);
    expect(listed).toBe(badge);
    expect(forYouTotal(forYou.items)).toBe(badge);
  });
});
