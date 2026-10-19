import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRequest, hideRequest } from "@/lib/data/requests";
import { resetSampleStore } from "@/lib/data/store";
import type { Account } from "@/lib/types";
import { Offer } from "./Offer";

const viewer = vi.hoisted(() => ({ account: null as null | Pick<Account, "id" | "seller"> }));

vi.mock("@/lib/auth/session", () => ({
  requireAccount: async (next: string) => {
    if (!viewer.account) throw new Error(`sign in, then ${next}`);
    return viewer.account;
  },
}));
vi.mock("@/lib/auth/form-state", () => ({ readFormState: async () => null }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("notFound");
  },
}));
vi.mock("@/lib/looking-for/actions", () => ({ sendOffer: async () => {} }));

const NOW = new Date("2026-10-14T08:42:00.000Z");
const post = () =>
  createRequest({
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

beforeEach(() => {
  resetSampleStore();
});

afterEach(() => {
  viewer.account = null;
});

describe("the offer composer for this visitor (community actions spec 2.8 and 2.9)", () => {
  it("gives an approved shop the form", async () => {
    const { id } = await post();
    viewer.account = { id: "acc-seller", seller: { status: "approved", sellerSlug: "tech-corner" } };
    render(await Offer({ requestId: id }));
    expect(screen.getByRole("button", { name: "Send offer" })).toBeInTheDocument();
  });

  it("tells a student without a shop where offers come from", async () => {
    const { id } = await post();
    viewer.account = { id: "acc-mentor", seller: null };
    render(await Offer({ requestId: id }));
    expect(screen.getByRole("link", { name: "Start selling" })).toHaveAttribute("href", "/sell");
  });

  it("is the 404 for a hidden or unknown request, even signed out", async () => {
    await hideRequest("r-001", "Not allowed.", NOW);
    await expect(Offer({ requestId: "r-001" })).rejects.toThrow("notFound");
    await expect(Offer({ requestId: "nope" })).rejects.toThrow("notFound");
  });

  it("sends a signed-out visitor to sign in, coming back to the composer", async () => {
    const { id } = await post();
    await expect(Offer({ requestId: id })).rejects.toThrow(`sign in, then /looking-for/${id}/offer`);
  });
});
