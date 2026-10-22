import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { SellerQueue } from "@/lib/types";
import { prefetchingLinks } from "@/tests/helpers/next-link";
import { Dashboard } from "./Dashboard";

// The form only needs something to post to; the actions have their own tests.
vi.mock("@/lib/selling/shop-actions", () => ({ pauseShop: async () => {}, resumeShop: async () => {} }));
vi.mock("next/link", async () => (await import("@/tests/helpers/next-link")).nextLinkShowingPrefetch);

const NOW = new Date("2026-10-14T10:00:00.000Z");
const none = { enquiries: 0, due: 0, repliedInTime: 0, salesConfirmed: 0 };
const EMPTY = { count: 0, oldest: null };
const QUIET: SellerQueue = {
  replies: EMPTY,
  sales: [],
  drafts: EMPTY,
  hidden: EMPTY,
  paused: EMPTY,
  listings: { available: 2, paused: 0, sold: 1, drafts: 0 },
  everReplied: true,
};

type Props = Parameters<typeof Dashboard>[0];
const BASE: Props = {
  shop: {
    name: "Tech corner",
    slug: "tech-corner",
    badge: "responsive",
    image: null,
    about: "Calculators and cables.",
    pickupPointIds: ["pp-midrand-library"],
  },
  paused: false,
  notice: null,
  now: NOW,
  queue: QUIET,
  record: { enquiries: 4, due: 4, repliedInTime: 3, salesConfirmed: 2 },
  badgeLine: "3 more confirmed sales for Trusted.",
  week: { enquiries: 5, due: 4, repliedInTime: 4, salesConfirmed: 1, previous: { ...none, enquiries: 2, salesConfirmed: 1 } },
  daily: [0, 1, 0, 2, 0, 1, 1],
  followers: { total: 38, recent: 3 },
  campusHasPoints: true,
};
const show = (extra: Partial<Props> = {}) => render(<Dashboard {...BASE} {...extra} />);

describe("the seller home (role views spec 7.1)", () => {
  it("shows a shop the Hub paused with its reason, no Resume and no storefront link (staff tools plan decision 3)", () => {
    show({ paused: true, hubPause: "Selling exam answers." });
    expect(within(screen.getByRole("banner")).getByText("Paused by the Hub")).toHaveAttribute("data-tone", "danger");
    expect(screen.getByRole("region", { name: "Why the Hub paused it" })).toHaveTextContent("Selling exam answers.");
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByRole("link", { name: "View your shop" })).toBeNull();
  });

  it("shows a card's error box when its reader failed, and keeps the others (spec 8)", () => {
    show({ queue: null, week: null });
    expect(screen.getByText("What needs you didn't load.")).toBeInTheDocument();
    expect(screen.getByText("Your numbers didn't load.")).toBeInTheDocument();
    expect(screen.getByText("Your listings didn't load.")).toBeInTheDocument();
    expect(screen.getByRole("meter")).toBeInTheDocument();
  });

  it("never prefetches (the header prefetches /sell on every page; CLAUDE.md)", () => {
    const { container } = show({ queue: { ...QUIET, everReplied: false } });
    expect(container.querySelectorAll("a[data-prefetch]").length).toBeGreaterThan(0);
    expect(prefetchingLinks(container)).toEqual([]);
  });
});
