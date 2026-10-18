import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { prefetchingLinks } from "@/tests/helpers/next-link";
import { ShopDeclined } from "./ShopDeclined";

vi.mock("@/lib/selling/shop-actions", () => ({ sendForApprovalAgain: async () => {} }));
// next/link draws a plain <a> in jsdom; this one shows `prefetch` as data, for the test that checks every link.
vi.mock("next/link", async () => (await import("@/tests/helpers/next-link")).nextLinkShowingPrefetch);

describe("a declined shop on /sell (staff tools plan decision 2)", () => {
  it("gives the Hub's reason, with Edit shop and Send for approval again", () => {
    render(<ShopDeclined shopName="Crochet corner" declinedAt="2026-10-14T08:42:00.000Z" reason="Add a photo of your work." />);
    expect(screen.getByRole("heading", { level: 1, name: "The Hub didn't approve your shop yet" })).toBeInTheDocument();
    expect(screen.getByText(/On 14 October 2026 the Hub looked at Crochet corner/)).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "What the Hub said" })).toHaveTextContent("Add a photo of your work.");
    expect(screen.getByRole("link", { name: "Edit shop" })).toHaveAttribute("href", "/sell/profile");
    expect(screen.getByRole("button", { name: "Send for approval again" })).toHaveAttribute("type", "submit");
  });

  it("says when and which shop in one piece of text, so a font swap can't make words jump (Task 17's lesson)", () => {
    render(<ShopDeclined shopName="Crochet corner" declinedAt="2026-10-14T08:42:00.000Z" reason="Add a photo." />);
    const lede = screen.getByText(/the Hub looked at Crochet corner/);
    expect([...lede.childNodes].filter((node) => node.nodeType === Node.TEXT_NODE)).toHaveLength(1);
    expect(lede.childNodes).toHaveLength(1);
  });

  it("keeps the reason as text, line breaks and all, and never prefetches (/sell is prefetched on every page)", () => {
    const { container } = render(
      <ShopDeclined shopName="Crochet corner" declinedAt="2026-10-14T08:42:00.000Z" reason={"<b>Two things</b>\nA photo."} />,
    );
    expect(screen.getByRole("region", { name: "What the Hub said" }).querySelector("blockquote")).toHaveTextContent(
      "<b>Two things</b> A photo.",
    );
    expect(container.querySelector("blockquote b")).toBeNull();
    expect(container.querySelectorAll("a[data-prefetch]").length).toBeGreaterThan(0);
    expect(prefetchingLinks(container)).toEqual([]);
  });
});
