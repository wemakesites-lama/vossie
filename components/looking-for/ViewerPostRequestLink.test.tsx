import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Account } from "@/lib/types";
import { ViewerPostRequestLink } from "./ViewerPostRequestLink";

const viewer = vi.hoisted(() => ({ account: null as null | Pick<Account, "id">, fails: false }));

vi.mock("@/lib/auth/session", () => ({
  getViewer: async () => {
    if (viewer.fails) throw new Error("session unavailable");
    return viewer.account;
  },
}));

afterEach(() => {
  viewer.account = null;
  viewer.fails = false;
});

const show = async () =>
  render(await ViewerPostRequestLink({ className: "btn btn-primary", children: "Post a request" }));

describe("Post a request, once the session is read (community actions spec section 3, plan, Task 16)", () => {
  it("is the sign-in link, back to the form, when signed out", async () => {
    await show();
    expect(screen.getByRole("link", { name: "Post a request" })).toHaveAttribute(
      "href",
      "/login?next=%2Flooking-for%2Fnew",
    );
  });

  it("opens the form itself when signed in", async () => {
    viewer.account = { id: "acc-student" };
    await show();
    const link = screen.getByRole("link", { name: "Post a request" });
    expect(link).toHaveAttribute("href", "/looking-for/new");
    expect(link).toHaveClass("btn", "btn-primary");
  });

  it("gives the sign-in link when the session can't be read, which still works", async () => {
    viewer.fails = true;
    await show();
    expect(screen.getByRole("link", { name: "Post a request" })).toHaveAttribute(
      "href",
      "/login?next=%2Flooking-for%2Fnew",
    );
  });
});
