import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { HubBanner } from "./HubBanner";

// The events read the cookie on the server; WhatsOn.test.tsx covers them.
vi.mock("./WhatsOn", () => ({
  WhatsOnEvents: () => <ul aria-label="Events" />,
  EventsSkeleton: () => null,
}));

describe("HubBanner (spec 7.13)", () => {
  it("introduces the Hub and holds What's on", async () => {
    const { container } = render(await HubBanner());
    expect(screen.getByRole("region", { name: "Built for student hustles, backed by the Hub" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Visit Launchpad" })).toHaveAttribute("href", "/hub");
    expect(screen.getByRole("heading", { level: 3, name: "What’s on" })).toBeInTheDocument();
    expect(container.querySelector(".hub-banner-media")).toHaveAttribute("aria-hidden", "true");
    expect(container.querySelector(".hub-banner-media img")).toHaveAttribute("alt", "");
  });
});
