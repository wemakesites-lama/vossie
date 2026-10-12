import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { recordRecentlyViewed } from "@/lib/recently-viewed";
import { ContextStripContent } from "./ContextStrip";
import { ContextStripView } from "./ContextStripView";

const viewer = vi.hoisted(() => ({ signedIn: true }));

vi.mock("@/lib/data/viewer", () => ({
  getViewerContext: async () => ({
    campus: "all",
    signedIn: viewer.signedIn,
    activity: viewer.signedIn ? { newMessages: 2, salesToConfirm: 1, savedItemsBack: 1 } : null,
  }),
}));

describe("ContextStripView (spec 7.4)", () => {
  it("shows the trust strip on a first visit", () => {
    render(<ContextStripView activity={null} />);
    expect(screen.getByRole("heading", { level: 2, name: "Why you can trust Vossie" })).toBeInTheDocument();
    expect(screen.getByText("Verified Incubation Hub sellers")).toBeInTheDocument();
    expect(screen.getByText("Never pay before you see it")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "How trust works" })).toHaveAttribute("href", "/safety");
  });

  it("picks up where a returning visitor left off", () => {
    recordRecentlyViewed({ id: "l-001", title: "Casio calculator", image: { src: "/p.svg", alt: "" } });
    render(<ContextStripView activity={null} />);
    expect(screen.getByRole("heading", { level: 2, name: "Pick up where you left off" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Casio calculator" })).toHaveAttribute("href", "/listings/l-001");
  });

  it("shows activity when signed in", () => {
    render(<ContextStripView activity={{ newMessages: 2, salesToConfirm: 1, savedItemsBack: 1 }} />);
    expect(screen.getByRole("heading", { level: 2, name: "Welcome back" })).toBeInTheDocument();
    expect(screen.getByText("2 new messages")).toBeInTheDocument();
    expect(screen.getByText("1 sale to confirm")).toBeInTheDocument();
    expect(screen.getByText("1 saved item is back")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open inbox" })).toHaveAttribute("href", "/account");
  });
});

describe("ContextStripContent", () => {
  it("passes the viewer's activity to the strip", async () => {
    viewer.signedIn = true;
    render(await ContextStripContent());
    expect(screen.getByRole("heading", { level: 2, name: "Welcome back" })).toBeInTheDocument();
  });

  it("shows the trust strip to a signed-out first visitor", async () => {
    viewer.signedIn = false;
    render(await ContextStripContent());
    expect(screen.getByRole("heading", { level: 2, name: "Why you can trust Vossie" })).toBeInTheDocument();
  });
});
