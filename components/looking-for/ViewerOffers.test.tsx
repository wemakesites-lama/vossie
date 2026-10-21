import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { startOffer } from "@/lib/data/messages";
import { createRequest, publicRequest } from "@/lib/data/requests";
import { resetSampleStore } from "@/lib/data/store";
import { ViewerOffers } from "./ViewerOffers";

const viewer = vi.hoisted(() => ({ account: null as null | { id: string } }));
const note = vi.hoisted(() => ({ notice: null as string | null }));

vi.mock("@/lib/auth/session", () => ({ getViewer: async () => viewer.account }));
vi.mock("@/lib/looking-for/form-state", () => ({
  takeNote: async () => (note.notice ? { notice: note.notice, values: {} } : null),
}));
vi.mock("@/lib/looking-for/actions", () => ({ closeMyRequest: async () => {}, reopenMyRequest: async () => {} }));

const NOW = new Date("2026-10-14T08:00:00.000Z");

// It reads the clock after connection() (stage L): a stand-in here, and a fixed day in the tests that post requests.
vi.mock("next/server", () => ({ connection: async () => undefined }));

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-14T08:42:00.000Z"));
  resetSampleStore();
});

afterEach(() => {
  vi.useRealTimers();
  viewer.account = null;
  note.notice = null;
});

async function posted() {
  const { id } = await createRequest({
    askerId: "acc-student",
    fields: {
      title: "Desk lamp for res",
      categorySlug: "res-living",
      campusSlug: "midrand",
      details: "A lamp that clips onto a desk, by the weekend.",
      budgetZar: null,
      swapWelcome: false,
      neededBy: null,
    },
    now: NOW,
  });
  await startOffer({
    askerId: "acc-student",
    request: { id, title: "Desk lamp for res" },
    sellerSlug: "tech-corner",
    listing: null,
    body: "I have a clip-on lamp, R120.",
    now: NOW,
  });
  return publicRequest(id)!;
}

describe("the offers panel, once the session is read (community actions spec 2.13)", () => {
  it("gives the asker their panel, with the offer and the status line", async () => {
    const request = await posted();
    viewer.account = { id: "acc-student" };
    note.notice = "posted";
    render(await ViewerOffers({ request }));
    expect(screen.getByText("Your request")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Tech corner/ })).toHaveTextContent("I have a clip-on lamp, R120.");
    expect(screen.getByRole("status")).toHaveTextContent("Your request is up.");
  });

  it("gives anyone else signed in Offer to help, straight to the composer", async () => {
    const request = await posted();
    viewer.account = { id: "acc-seller" };
    render(await ViewerOffers({ request }));
    expect(screen.getByRole("link", { name: "Offer to help" })).toHaveAttribute(
      "href",
      `/looking-for/${request.id}/offer`,
    );
    expect(screen.queryByText("Your request")).toBeNull();
  });

  it("gives a signed-out visitor Offer to help through sign-in", async () => {
    const request = await posted();
    render(await ViewerOffers({ request }));
    expect(screen.getByRole("link", { name: "Offer to help" })).toHaveAttribute(
      "href",
      `/login?next=${encodeURIComponent(`/looking-for/${request.id}/offer`)}`,
    );
  });

  it("works out from today whether it takes offers, and stores a due request's close (stage L spec decisions 11 and 15)", async () => {
    const { id } = await createRequest({
      askerId: "acc-student",
      fields: {
        title: "Kettle for res",
        categorySlug: "res-living",
        campusSlug: "midrand",
        details: "A working kettle for my res room, please.",
        budgetZar: null,
        swapWelcome: false,
        neededBy: "2026-10-09",
      },
      now: new Date("2026-10-05T08:00:00.000Z"),
    });
    // The page's cached copy still says open: nothing has settled it yet.
    const request = publicRequest(id)!;
    expect(request.status).toBe("open");
    render(await ViewerOffers({ request }));
    expect(screen.getByText("This request is closed")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Offer to help" })).toBeNull();
    expect(publicRequest(id)?.status).toBe("closed");
  });
});
