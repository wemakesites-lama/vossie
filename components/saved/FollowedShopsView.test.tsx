import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { FollowedShop } from "@/lib/types";
import { FollowedShopsView } from "./FollowedShopsView";

vi.mock("@/lib/following/actions", () => ({ unfollowShop: async () => {} }));

const NAMES = new Map([
  ["midrand", "Midrand"],
  ["pretoria", "Pretoria"],
]);

const shop = (overrides: Partial<FollowedShop>): FollowedShop => ({
  slug: "tech-corner",
  name: "Tech corner",
  campusSlug: "midrand",
  image: { src: "/placeholders/seller/tech-corner.svg", alt: "The tech corner at work" },
  paused: false,
  storefront: true,
  listed: 2,
  ...overrides,
});

describe("the shops you follow (community actions spec 2.17)", () => {
  it("shows each as the Hub's small card, with what it has listed and Unfollow", () => {
    render(
      <FollowedShopsView
        shops={[shop({}), shop({ slug: "code-coach", name: "Code coach", campusSlug: "pretoria", paused: true, listed: 0 })]}
        campusNames={NAMES}
        notice={null}
      />,
    );
    expect(screen.getByText("2 shops")).toBeInTheDocument();
    const [tech, coach] = screen.getAllByRole("listitem");
    expect(within(tech).getByRole("link")).toHaveAttribute("href", "/sellers/tech-corner");
    expect(within(tech).getByRole("link")).toHaveTextContent("Tech corner Midrand 2 listings");
    expect(within(coach).getByRole("link")).toHaveTextContent("Code coach Pretoria Paused Nothing listed right now");
    expect(within(tech).getByRole("button", { name: "Unfollow Tech corner" })).toHaveAttribute("type", "submit");
    expect(tech.querySelector('input[name="from"]')).toHaveValue("saved");
    expect(tech.querySelector('input[name="shop"]')).toHaveValue("tech-corner");
  });

  it("counts one shop in the singular", () => {
    render(<FollowedShopsView shops={[shop({ listed: 1 })]} campusNames={NAMES} notice={null} />);
    expect(screen.getByText("1 shop")).toBeInTheDocument();
    expect(screen.getByRole("listitem")).toHaveTextContent("1 listing");
  });

  it("shows a shop the Hub paused as a card with no link, since its storefront is the 404, but with Unfollow (amendment 17.6)", () => {
    render(
      <FollowedShopsView
        shops={[shop({ name: "Code coach", slug: "code-coach", paused: true, storefront: false, listed: 0 })]}
        campusNames={NAMES}
        notice={null}
      />,
    );
    const card = screen.getByRole("listitem");
    expect(within(card).queryByRole("link")).toBeNull();
    expect(card).toHaveTextContent("Code coach Midrand Paused Nothing listed right now");
    expect(within(card).getByRole("button", { name: "Unfollow Code coach" })).toBeInTheDocument();
  });

  it("says what the last unfollow did", () => {
    render(<FollowedShopsView shops={[]} campusNames={NAMES} notice="You've unfollowed Tech corner." />);
    expect(screen.getByRole("status")).toHaveTextContent("You've unfollowed Tech corner.");
  });

  it("says how to follow one when there are none", () => {
    render(<FollowedShopsView shops={[]} campusNames={NAMES} notice={null} />);
    expect(screen.getByText("Follow a shop from its page and it shows here.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Browse" })).toHaveAttribute("href", "/browse");
  });

  it("asks a signed-out visitor to sign in, coming back to the tab", () => {
    render(<FollowedShopsView shops={null} campusNames={NAMES} notice={null} />);
    expect(screen.getByText("Sign in to follow shops. They'll show here.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/login?next=%2Fsaved%3Ftab%3Dshops");
  });
});
