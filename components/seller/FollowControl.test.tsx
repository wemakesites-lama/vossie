import { render, screen, within } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { FollowControl } from "./FollowControl";
import { FollowButtons } from "./FollowViews";

// The session's part never arrives here, so what renders is the static shell's fallback (plan decision 16).
vi.mock("./ViewerFollow", async () => {
  const { use } = await import("react");
  const never = new Promise<never>(() => {});
  return { ViewerFollow: () => use(never) };
});
vi.mock("@/lib/following/actions", () => ({ followShop: async () => {}, unfollowShop: async () => {} }));

describe("Follow on the storefront's band (community actions spec 2.16)", () => {
  it("is a Follow link through sign-in, back to the shop, in the static shell", () => {
    const container = document.createElement("div");
    container.innerHTML = renderToString(<FollowControl slug="tech-corner" name="Tech corner" />);
    const link = within(container).getByRole("link", { name: "Follow Tech corner" });
    expect(link).toHaveAttribute("href", "/login?next=%2Fsellers%2Ftech-corner");
    expect(link).toHaveClass("btn-sky");
    expect(container.querySelector(".seller-follow")).not.toBeNull();
  });

  it("is a Follow button when signed in, naming the shop", () => {
    render(<FollowButtons slug="tech-corner" name="Tech corner" following={false} notice={null} />);
    expect(screen.getByRole("button", { name: "Follow Tech corner" })).toHaveAttribute("type", "submit");
    expect(document.querySelector('input[name="shop"]')).toHaveValue("tech-corner");
    expect(document.querySelector('input[name="from"]')).toBeNull();
  });

  it("says you follow the shop, with Unfollow, and no pressed state (the words say what it does)", () => {
    render(<FollowButtons slug="tech-corner" name="Tech corner" following notice={null} />);
    expect(screen.getByText("You follow this shop")).toBeInTheDocument();
    const unfollow = screen.getByRole("button", { name: "Unfollow Tech corner" });
    expect(unfollow).not.toHaveAttribute("aria-pressed");
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("says what the last press did, once (plan decision 7)", () => {
    const { unmount } = render(<FollowButtons slug="tech-corner" name="Tech corner" following notice="followed" />);
    expect(screen.getByRole("status")).toHaveTextContent("You follow Tech corner.");
    unmount();
    const again = render(<FollowButtons slug="tech-corner" name="Tech corner" following={false} notice="unfollowed" />);
    expect(screen.getByRole("status")).toHaveTextContent("Unfollowed.");
    again.unmount();
    render(<FollowButtons slug="tech-corner" name="Tech corner" following={false} notice="follow-limit" />);
    expect(screen.getByRole("status")).toHaveTextContent("You follow 200 shops. Unfollow one first.");
  });
});
