import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRequest, hideRequest } from "@/lib/data/requests";
import { resetSampleStore } from "@/lib/data/store";
import { DeleteRequest } from "./DeleteRequest";

const viewer = vi.hoisted(() => ({ account: null as null | { id: string } }));

vi.mock("@/lib/auth/session", () => ({
  requireAccount: async (next: string) => {
    if (!viewer.account) throw new Error(`sign in, then ${next}`);
    return viewer.account;
  },
}));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("notFound");
  },
}));
vi.mock("@/lib/looking-for/actions", () => ({ deleteMyRequest: async () => {} }));

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
});

describe("Delete request's confirm page (community actions spec 2.6 and section 4)", () => {
  it("repeats what will happen, with Delete request and Keep it", async () => {
    const { id } = await post();
    viewer.account = { id: "acc-student" };
    render(await DeleteRequest({ requestId: id }));
    expect(screen.getByRole("heading", { level: 1, name: "Delete your request" })).toBeInTheDocument();
    expect(screen.getByText("Delete Desk lamp for res? This can't be undone.")).toBeInTheDocument();
    expect(screen.getByText(/marked "This request was removed"/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete request" })).toHaveAttribute("type", "submit");
    expect(document.querySelector('input[name="request"]')).toHaveValue(id);
    expect(screen.getByRole("link", { name: "Keep it" })).toHaveAttribute("href", `/looking-for/${id}`);
  });

  it("keeps a hidden request's way back on Your requests, since its page is gone", async () => {
    const { id } = await post();
    await hideRequest(id, "Not allowed.", NOW);
    viewer.account = { id: "acc-student" };
    render(await DeleteRequest({ requestId: id }));
    expect(screen.getByRole("link", { name: "Keep it" })).toHaveAttribute("href", "/account/requests");
  });

  it("is the 404 for anyone but the asker", async () => {
    const { id } = await post();
    viewer.account = { id: "acc-mentor" };
    await expect(DeleteRequest({ requestId: id })).rejects.toThrow("notFound");
  });
});
