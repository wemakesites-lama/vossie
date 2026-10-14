import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ReportSentBack } from "./ReportSentBack";

// Link shows its prefetch as data-prefetch, to check that no link here prefetches (decision 53).
vi.mock("next/link", async () => (await import("@/tests/helpers/next-link")).nextLinkShowingPrefetch);

describe("the thank-you's way back (messaging spec 3.4)", () => {
  it("goes back to what was reported, or home when the address names nothing", async () => {
    const { unmount } = render(await ReportSentBack({ params: { listing: "l-001" } }));
    expect(screen.getByRole("link", { name: "Back to the listing" })).toHaveAttribute("href", "/listings/l-001");
    unmount();
    const bad = render(await ReportSentBack({ params: { listing: "../x" } }));
    expect(screen.getByRole("link", { name: "Back to the homepage" })).toHaveAttribute("href", "/");
    bad.unmount();
    render(await ReportSentBack({ params: { listing: "l-nope" } }));
    expect(screen.getByRole("link", { name: "Back to the homepage" })).toHaveAttribute("href", "/");
  });

  it("doesn't prefetch either way back (CLAUDE.md, decision 53, plan amendment 6)", async () => {
    const back = render(await ReportSentBack({ params: { listing: "l-001" } }));
    expect(screen.getByRole("link", { name: "Back to the listing" })).toHaveAttribute("data-prefetch", "false");
    back.unmount();
    render(await ReportSentBack({ params: {} }));
    expect(screen.getByRole("link", { name: "Back to the homepage" })).toHaveAttribute("data-prefetch", "false");
  });
});
