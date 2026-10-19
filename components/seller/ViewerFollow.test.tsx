import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { addFollow } from "@/lib/data/follows";
import { resetSampleStore } from "@/lib/data/store";
import type { Account } from "@/lib/types";
import { ViewerFollow } from "./ViewerFollow";

const viewer = vi.hoisted(() => ({ account: null as null | Pick<Account, "id" | "seller">, fails: false }));
const note = vi.hoisted(() => ({ notice: null as string | null }));

vi.mock("@/lib/auth/session", () => ({
  getViewer: async () => {
    if (viewer.fails) throw new Error("session unavailable");
    return viewer.account;
  },
}));
vi.mock("@/lib/looking-for/form-state", () => ({
  takeNote: async () => (note.notice ? { notice: note.notice, values: {} } : null),
}));
vi.mock("@/lib/following/actions", () => ({ followShop: async () => {}, unfollowShop: async () => {} }));

beforeEach(() => {
  resetSampleStore();
});

afterEach(() => {
  viewer.account = null;
  viewer.fails = false;
  note.notice = null;
});

describe("Follow, once the session is read (community actions spec 2.16)", () => {
  it("is the sign-in link when signed out", async () => {
    render(await ViewerFollow({ slug: "tech-corner", name: "Tech corner" }));
    expect(screen.getByRole("link", { name: "Follow Tech corner" })).toHaveAttribute(
      "href",
      "/login?next=%2Fsellers%2Ftech-corner",
    );
  });

  it("is the sign-in link when the session can't be read, which still works", async () => {
    viewer.fails = true;
    render(await ViewerFollow({ slug: "tech-corner", name: "Tech corner" }));
    expect(screen.getByRole("link", { name: "Follow Tech corner" })).toHaveAttribute(
      "href",
      "/login?next=%2Fsellers%2Ftech-corner",
    );
  });

  it("is Follow, or Unfollow once the visitor follows the shop", async () => {
    viewer.account = { id: "acc-student", seller: null };
    const { unmount } = render(await ViewerFollow({ slug: "tech-corner", name: "Tech corner" }));
    expect(screen.getByRole("button", { name: "Follow Tech corner" })).toBeInTheDocument();
    unmount();
    await addFollow("acc-student", "tech-corner", new Date("2026-10-14T08:42:00.000Z"));
    render(await ViewerFollow({ slug: "tech-corner", name: "Tech corner" }));
    expect(screen.getByRole("button", { name: "Unfollow Tech corner" })).toBeInTheDocument();
  });

  it("passes on the last press's status line", async () => {
    viewer.account = { id: "acc-student", seller: null };
    await addFollow("acc-student", "tech-corner", new Date("2026-10-14T08:42:00.000Z"));
    note.notice = "followed";
    render(await ViewerFollow({ slug: "tech-corner", name: "Tech corner" }));
    expect(screen.getByRole("status")).toHaveTextContent("You follow Tech corner.");
  });

  it("is nothing for the shop's owner, who has Edit shop in the band", async () => {
    viewer.account = { id: "acc-seller", seller: { status: "approved", sellerSlug: "tech-corner" } };
    expect(await ViewerFollow({ slug: "tech-corner", name: "Tech corner" })).toBeNull();
  });
});
