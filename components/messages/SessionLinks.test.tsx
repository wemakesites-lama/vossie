import { within } from "@testing-library/react";
import type { ReactElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { MessageSellerLink, ReportLink } from "./SessionLinks";

// The session's part never arrives here, so what renders is the static shell's fallback (plan decision 3).
vi.mock("./ViewerLinks", async () => {
  const { use } = await import("react");
  const never = new Promise<never>(() => {});
  const Streaming = () => use(never);
  return { ViewerMessageLink: Streaming, ViewerReportLink: Streaming };
});

/** Server-renders `element`, as the static shell is, and gives back its HTML in a container to query. */
function shell(element: ReactElement) {
  const container = document.createElement("div");
  container.innerHTML = renderToString(element);
  return within(container);
}

describe("the session's links in the static shell (messaging spec 3.6, plan decision 3)", () => {
  it("has Message seller go through sign-in to the composer", () => {
    const page = shell(
      <MessageSellerLink target={{ kind: "listing", listingId: "l-001" }} className="btn btn-primary listing-message">
        Message seller
      </MessageSellerLink>,
    );
    const link = page.getByRole("link", { name: "Message seller" });
    expect(link).toHaveAttribute("href", "/login?next=%2Flistings%2Fl-001%2Fmessage");
    expect(link).toHaveClass("listing-message");
  });

  it("has Report go through sign-in to the report form", () => {
    const page = shell(<ReportLink target={{ kind: "seller", id: "tech-corner" }}>Report this seller</ReportLink>);
    expect(page.getByRole("link", { name: "Report this seller" })).toHaveAttribute(
      "href",
      "/login?next=%2Freport%3Fseller%3Dtech-corner",
    );
  });
});
