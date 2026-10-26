import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { getCampuses, getVerifiedSellers } from "@/lib/data";
import { VerifiedShops } from "./VerifiedShops";

async function show({ failed = false } = {}) {
  const [sellers, campuses] = await Promise.all([getVerifiedSellers(), getCampuses()]);
  render(
    <VerifiedShops
      sellers={failed ? null : sellers}
      campusNames={new Map(campuses.map((campus) => [campus.slug, campus.name]))}
    />,
  );
}

describe("VerifiedShops (Launchpad spec 4.4)", () => {
  it("lists every verified shop, A to Z, each named by its link to the shop, with what it sells and where", async () => {
    await show();
    const list = within(screen.getByRole("region", { name: "Verified shops" })).getByRole("list");
    const rows = within(list).getAllByRole("listitem");
    expect(rows).toHaveLength(9);
    expect(within(rows[0]).getByRole("link")).toHaveAccessibleName("Code coach");
    expect(within(rows[0]).getByRole("link")).toHaveAttribute("href", "/sellers/code-coach");
    expect(rows[0]).toHaveTextContent(/· Pretoria/);
    expect(rows[0]).toHaveTextContent("Verified");
    expect(within(rows[8]).getByRole("link")).toHaveAccessibleName("Thrift rack");
  });

  it("says who checked them and links to how Verified works", async () => {
    await show();
    expect(screen.getByText(/The Hub has met every one of these shops/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "How Verified works" })).toHaveAttribute("href", "/trust");
  });

  it("keeps the photos out of the reading order: the names say who", async () => {
    await show();
    const region = screen.getByRole("region", { name: "Verified shops" });
    for (const image of region.querySelectorAll("img")) expect(image).toHaveAttribute("alt", "");
  });

  it("shows its own error, with a way back", async () => {
    await show({ failed: true });
    expect(screen.getByText("Verified shops didn't load.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Try again" })).toHaveAttribute(
      "href",
      "/hub?retry=hub-verified#hub-verified",
    );
  });
});
