import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ViewerMessageLink, ViewerReportLink } from "./ViewerLinks";

const links = vi.hoisted(() => ({ failing: false }));
const selling = vi.hoisted(() => ({ owner: null as { href: string; label: string } | null, failing: false }));

vi.mock("@/lib/messaging/links", () => ({
  messageHrefFor: async () => {
    if (links.failing) throw new Error("The session store didn't answer");
    return "/messages/conv-s2";
  },
  reportHrefFor: async () => {
    if (links.failing) throw new Error("The session store didn't answer");
    return "/report?listing=l-001";
  },
}));

// The owner's link (selling plan, Task 14): none unless a test sets one.
vi.mock("@/lib/selling/links", () => ({
  ownerLinkFor: async () => {
    if (selling.failing) throw new Error("The listing lookup didn't answer");
    return selling.owner;
  },
}));

afterEach(() => {
  links.failing = false;
  selling.owner = null;
  selling.failing = false;
});

describe("the session's links, once the session is read (messaging spec 3.6)", () => {
  it("sends Message seller where the session says, keeping its look", async () => {
    render(
      await ViewerMessageLink({
        target: { kind: "listing", listingId: "l-001" },
        className: "btn btn-primary listing-message",
        children: "Message seller",
      }),
    );
    const link = screen.getByRole("link", { name: "Message seller" });
    expect(link).toHaveAttribute("href", "/messages/conv-s2");
    expect(link).toHaveClass("btn", "btn-primary", "listing-message");
  });

  it("sends Report to the form", async () => {
    render(await ViewerReportLink({ target: { kind: "listing", id: "l-001" }, children: "Report this listing" }));
    expect(screen.getByRole("link", { name: "Report this listing" })).toHaveAttribute("href", "/report?listing=l-001");
  });

  it("falls back to the signed-out links when the lookup fails, which still work", async () => {
    links.failing = true;
    const { unmount } = render(
      await ViewerMessageLink({ target: { kind: "shop", sellerSlug: "tech-corner" }, children: "Message seller" }),
    );
    expect(screen.getByRole("link", { name: "Message seller" })).toHaveAttribute(
      "href",
      "/login?next=%2Fsellers%2Ftech-corner%2Fmessage",
    );
    unmount();
    render(await ViewerReportLink({ target: { kind: "request", id: "r-001" }, children: "Report this request" }));
    expect(screen.getByRole("link", { name: "Report this request" })).toHaveAttribute(
      "href",
      "/login?next=%2Freport%3Frequest%3Dr-001",
    );
  });

  it("gives Message seller as usual when the owner's lookup fails (amendment 13.8)", async () => {
    selling.failing = true;
    render(
      await ViewerMessageLink({
        target: { kind: "listing", listingId: "l-001" },
        className: "btn btn-primary listing-message",
        children: "Message seller",
      }),
    );
    const link = screen.getByRole("link", { name: "Message seller" });
    expect(link).toHaveAttribute("href", "/messages/conv-s2");
    expect(link).toHaveClass("btn", "btn-primary", "listing-message");
  });

  it("gives the owner Edit listing in Message seller's place, with the same look (selling spec 2.12)", async () => {
    selling.owner = { href: "/sell/listings/l-001/edit", label: "Edit listing" };
    render(
      await ViewerMessageLink({
        target: { kind: "listing", listingId: "l-001" },
        className: "btn btn-primary listing-message",
        children: "Message seller",
      }),
    );
    const link = screen.getByRole("link", { name: "Edit listing" });
    expect(link).toHaveAttribute("href", "/sell/listings/l-001/edit");
    expect(link).toHaveClass("btn", "btn-primary", "listing-message");
    expect(screen.queryByRole("link", { name: "Message seller" })).toBeNull();
  });
});
