import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ViewerMessageLink, ViewerReportLink } from "./ViewerLinks";

const links = vi.hoisted(() => ({ failing: false }));

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

afterEach(() => {
  links.failing = false;
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
});
