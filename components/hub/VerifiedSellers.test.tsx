import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { getCampuses, getVerifiedSellers } from "@/lib/data";
import { VerifiedSellers } from "./VerifiedSellers";

async function show({ failed = false } = {}) {
  const [sellers, campuses] = await Promise.all([getVerifiedSellers(), getCampuses()]);
  render(
    <VerifiedSellers
      sellers={failed ? null : sellers}
      campusNames={new Map(campuses.map((campus) => [campus.slug, campus.name]))}
    />,
  );
}

describe("VerifiedSellers (community spec 5.1, decision 8)", () => {
  it("shows every verified seller, A to Z, each linking to their shop", async () => {
    await show();
    const links = within(screen.getByRole("region", { name: "Verified by the Hub" })).getAllByRole("link");
    expect(links).toHaveLength(9);
    expect(links[0]).toHaveAccessibleName("Code coach Pretoria");
    expect(links[0]).toHaveAttribute("href", "/sellers/code-coach");
    expect(links[8]).toHaveAccessibleName("Thrift rack Pretoria");
  });

  it("keeps the photos out of the reading order: the names say who", async () => {
    await show();
    const region = screen.getByRole("region", { name: "Verified by the Hub" });
    for (const image of region.querySelectorAll("img")) expect(image).toHaveAttribute("alt", "");
  });

  it("shows its own error, with a way back to the Hub", async () => {
    await show({ failed: true });
    expect(screen.getByText("Verified sellers didn't load.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Try again" })).toHaveAttribute(
      "href",
      "/hub?retry=hub-verified#hub-verified",
    );
  });
});
