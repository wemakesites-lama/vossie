import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { addFollow } from "@/lib/data/follows";
import { resetSampleStore } from "@/lib/data/store";
import { FollowedShops } from "./FollowedShops";

const viewer = vi.hoisted(() => ({ account: null as null | { id: string }, fails: false }));
const note = vi.hoisted(() => ({ notice: null as string | null }));

vi.mock("@/lib/auth/session", () => ({
  getViewer: async () => {
    if (viewer.fails) throw new Error("session unavailable");
    return viewer.account;
  },
}));
vi.mock("@/lib/looking-for/form-state", () => ({
  takeNote: async () => (note.notice ? { notice: note.notice, values: { shop: "Code coach" } } : null),
}));
vi.mock("@/lib/following/actions", () => ({ unfollowShop: async () => {} }));

beforeEach(() => {
  resetSampleStore();
});

afterEach(() => {
  viewer.account = null;
  viewer.fails = false;
  note.notice = null;
});

describe("the shops you follow, for this visitor (community actions spec 2.17)", () => {
  it("lists the visitor's follows, with the last unfollow's status line", async () => {
    await addFollow("acc-student", "tech-corner", new Date("2026-10-14T08:42:00.000Z"));
    viewer.account = { id: "acc-student" };
    note.notice = "unfollowed";
    render(await FollowedShops());
    expect(screen.getByRole("button", { name: "Unfollow Tech corner" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("You've unfollowed Code coach.");
  });

  it("names the campus and links the storefront", async () => {
    await addFollow("acc-student", "tech-corner", new Date("2026-10-14T08:42:00.000Z"));
    viewer.account = { id: "acc-student" };
    render(await FollowedShops());
    expect(screen.getByRole("link")).toHaveAttribute("href", "/sellers/tech-corner");
    expect(screen.getByRole("link")).toHaveTextContent("Tech corner Midrand");
  });

  it("asks a signed-out visitor to sign in", async () => {
    render(await FollowedShops());
    expect(screen.getByRole("link", { name: "Sign in" })).toBeInTheDocument();
  });

  it("asks to sign in when the session can't be read, which still works", async () => {
    viewer.fails = true;
    render(await FollowedShops());
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/login?next=%2Fsaved%3Ftab%3Dshops");
  });
});
