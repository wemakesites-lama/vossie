import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PausedOwnerOrBanner, ViewerMessageLink, ViewerReportLink } from "./ViewerLinks";

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
    if (selling.failing) throw new Error("The session store didn't answer");
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

describe("a paused shop's band, once the session is read (selling spec 2.12, plan amendment 10)", () => {
  const banner = <p className="availability-banner seller-paused">Not taking orders right now</p>;
  const show = async () =>
    render(await PausedOwnerOrBanner({ slug: "tech-corner", className: "btn btn-sky seller-message", children: banner }));

  it("gives the owner Edit shop in the banner's place, with the Message pill's look", async () => {
    selling.owner = { href: "/sell/profile", label: "Edit shop" };
    await show();
    const link = screen.getByRole("link", { name: "Edit shop" });
    expect(link).toHaveAttribute("href", "/sell/profile");
    expect(link).toHaveClass("btn", "btn-sky", "seller-message");
    expect(screen.queryByText("Not taking orders right now")).toBeNull();
  });

  it("keeps the banner for everyone else, and when the lookup fails", async () => {
    const { unmount } = await show();
    expect(screen.getByText("Not taking orders right now")).toHaveClass("availability-banner", "seller-paused");
    expect(screen.queryByRole("link")).toBeNull();
    unmount();
    selling.failing = true;
    await show();
    expect(screen.getByText("Not taking orders right now")).toBeInTheDocument();
  });
});
