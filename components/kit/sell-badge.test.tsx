import { render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SellHome } from "@/components/sell/SellHome";
import { resetSampleStore, sampleStore } from "@/lib/data/store";
import { SellBar } from "./sections";

// The real sample store and the real readers; only the session is Tech corner's owner.
const viewer = vi.hoisted(() => ({ id: "acc-seller" }));
vi.mock("@/lib/auth/session", async () => {
  const { getAccount } = await import("@/lib/data/accounts");
  return { getViewer: async () => getAccount(viewer.id), getSessionKey: async () => null };
});
vi.mock("next/server", async () => (await import("@/tests/helpers/next-request")).nextServer());
vi.mock("@/lib/selling/shop-actions", () => ({
  pauseShop: async () => {},
  resumeShop: async () => {},
  sendForApprovalAgain: async () => {},
}));

const NOW = new Date("2026-10-14T10:00:00.000Z");

beforeEach(() => {
  resetSampleStore();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

/** A buyer who asked Tech corner about its headset `hours` ago and is still waiting. */
function waiting(id: string, buyerId: string, hours: number) {
  const at = new Date(NOW.getTime() - hours * 3_600_000).toISOString();
  sampleStore().conversations.set(id, {
    id,
    listingId: "l-007",
    listingTitle: "Gaming headset, barely used",
    sellerSlug: "tech-corner",
    buyerId,
    sellerGone: false,
    status: "asked",
    createdAt: at,
    lastMessageAt: at,
    firstReplyAt: null,
    completedAt: null,
    confirmedAt: null,
    confirmedBy: null,
  });
}

describe("the seller bar's Messages badge equals the home's Needs-you row (role views spec 4.2)", () => {
  it("counts the same buyers waiting, from the same reader", async () => {
    waiting("conv-w1", "acc-student", 3);
    waiting("conv-w2", "acc-mentor", 30);
    waiting("conv-w3", "acc-admin", 50);
    render(
      <>
        {await SellBar()}
        {await SellHome()}
      </>,
    );
    const messages = within(screen.getByRole("navigation", { name: "Selling" })).getByRole("link", { name: "Messages" });
    expect(messages).toHaveAccessibleDescription(/^3\s+buyers waiting for a reply$/);
    const row = within(screen.getByRole("list", { name: "Needs you" })).getByRole("link", { name: /Buyers waiting for a reply/ });
    expect(row.querySelector(".needs-count")).toHaveTextContent("3");
  });
});
