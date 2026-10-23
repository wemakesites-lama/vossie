import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ActivityLines } from "./ActivityLines";

vi.mock("next/link", async () => (await import("@/tests/helpers/next-link")).nextLinkShowingPrefetch);

describe("the signed-in strip's lines (spec 7.4; role views N5)", () => {
  it("says what's new, each count in words", () => {
    render(<ActivityLines activity={{ newMessages: 2, salesToConfirm: 1, newNotifications: 0 }} />);
    expect(screen.getByText("2 new messages")).toBeInTheDocument();
    expect(screen.getByText("1 sale to confirm")).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("links new notifications to Notifications, with no prefetch", () => {
    render(<ActivityLines activity={{ newMessages: 1, salesToConfirm: 0, newNotifications: 1 }} />);
    expect(screen.getByText("1 new message")).toBeInTheDocument();
    const link = screen.getByRole("link", { name: "1 new notification" });
    expect(link).toHaveAttribute("href", "/notifications");
    expect(link.dataset.prefetch).toBe("false");
  });
});
