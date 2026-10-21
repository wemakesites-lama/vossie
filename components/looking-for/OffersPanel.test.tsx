import { render, screen, within } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { requests } from "@/data/fixtures/requests";
import type { OwnRequest } from "@/lib/types";
import { OffersPanel } from "./OffersPanel";
import { AskerOffers, PublicOffers } from "./OffersViews";

// The session's part never arrives here, so what renders is the static shell's fallback (plan decision 19).
vi.mock("./ViewerOffers", async () => {
  const { use } = await import("react");
  const never = new Promise<never>(() => {});
  return { ViewerOffers: () => use(never) };
});
vi.mock("@/lib/looking-for/actions", () => ({ closeMyRequest: async () => {}, reopenMyRequest: async () => {} }));

const OPEN = requests[0];
const CLOSED = requests.find((request) => request.status === "closed")!;

const own = (state: OwnRequest["state"]): OwnRequest => ({
  request: { ...OPEN, id: "r-abc", title: "Desk lamp for res", offers: 1, status: state === "closed" ? "closed" : "open" },
  state,
  hiddenReason: null,
  closedAt: null,
  closedAutomatically: false,
  closeReason: null,
  neededByPassed: false,
});

describe("the public offers panel (community spec 4.2, community actions spec section 3)", () => {
  it("is in the static shell, signed out: the count, and Offer to help through sign-in to the composer", () => {
    const container = document.createElement("div");
    container.innerHTML = renderToString(<OffersPanel request={OPEN} />);
    const shell = within(container);
    // The container isn't in the document, so check the element by its class rather than toBeInTheDocument.
    expect(shell.getByText("2 offers so far")).toHaveClass("request-offers-count");
    expect(shell.getByRole("link", { name: "Offer to help" })).toHaveAttribute(
      "href",
      "/login?next=%2Flooking-for%2Fr-001%2Foffer",
    );
  });

  it("goes straight to the composer when signed in, and says when the request is closed", () => {
    const { unmount } = render(<PublicOffers request={OPEN} signedIn open />);
    expect(screen.getByRole("link", { name: "Offer to help" })).toHaveAttribute("href", "/looking-for/r-001/offer");
    unmount();
    render(<PublicOffers request={CLOSED} signedIn open={false} />);
    expect(screen.getByText("This request is closed")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Offer to help" })).toBeNull();
  });

  it("says closed when today has closed it, though the cached request still says open (stage L spec decision 15)", () => {
    render(<PublicOffers request={OPEN} signedIn open={false} />);
    expect(screen.getByText("This request is closed")).toHaveClass("request-offers-count");
    expect(screen.queryByRole("link", { name: "Offer to help" })).toBeNull();
  });
});

describe("the asker's panel (community actions spec 2.13, plan decision 19)", () => {
  it("shows Your request, the count, each offer linking to its thread, the status line and the actions", () => {
    const offers = [
      {
        conversationId: "conv-abc",
        shopName: "Tech corner",
        preview: "I have a clip-on lamp, R120.",
        offeredAt: "2026-10-14T08:00:00.000Z",
      },
    ];
    render(<AskerOffers own={own("open")} offers={offers} notice="Your request is up." />);
    expect(screen.getByText("Your request")).toBeInTheDocument();
    expect(screen.getByText("1 offer")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Your request is up.");
    const offer = screen.getByRole("link", { name: /Tech corner/ });
    expect(offer).toHaveAttribute("href", "/messages/conv-abc");
    expect(offer).toHaveTextContent("Wed 14 Oct · 10:00");
    expect(offer).toHaveTextContent("I have a clip-on lamp, R120.");
    expect(screen.getByText("Found it? Close it so shops stop offering.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Close Desk lamp for res" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Edit Desk lamp for res" })).toHaveAttribute(
      "href",
      "/looking-for/r-abc/edit",
    );
    expect(document.querySelector('input[name="from"]')).toBeNull();
    expect(screen.queryByRole("link", { name: "Offer to help" })).toBeNull();
  });

  it("offers Reopen on a closed request, and says when there are no offers yet", () => {
    const closed = own("closed");
    render(<AskerOffers own={{ ...closed, request: { ...closed.request, offers: 0 } }} offers={[]} notice={null} />);
    expect(screen.getByText("No offers yet")).toBeInTheDocument();
    expect(screen.getByText("This request is closed")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reopen Desk lamp for res" })).toBeInTheDocument();
    expect(screen.queryByText(/Found it\?/)).toBeNull();
  });

  it("tells the asker when the request will close, or that it closed itself and why (stage L spec section 4)", () => {
    const open = own("open");
    const { unmount } = render(
      <AskerOffers own={{ ...open, request: { ...open.request, closesOn: "2026-11-13" } }} offers={[]} notice={null} />,
    );
    expect(screen.getByText(/^Closes automatically on/)).toHaveTextContent("Closes automatically on 13 Nov.");
    unmount();
    render(
      <AskerOffers
        own={{
          ...own("closed"),
          closedAt: "2026-11-11T22:00:00.000Z",
          closedAutomatically: true,
          closeReason: "idle",
          neededByPassed: false,
        }}
        offers={[]}
        notice={null}
      />,
    );
    expect(screen.getByText("This request is closed")).toBeInTheDocument();
    expect(screen.getByText(/^Closed automatically on/)).toHaveTextContent(
      "Closed automatically on 12 Nov, after 30 days with no changes.",
    );
    expect(screen.getByRole("button", { name: "Reopen Desk lamp for res" })).not.toHaveAccessibleDescription();
  });
});
