import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { MentoredShop } from "@/lib/types";
import { MentorDashboard } from "./MentorDashboard";

const tech: MentoredShop = {
  slug: "tech-corner",
  name: "Tech corner",
  campusSlug: "midrand",
  ownerName: "Sipho",
  ownerId: "acc-seller",
  badge: "responsive",
  status: "paused",
  mentorId: "acc-mentor",
  mentorName: "Naledi",
  counts: { enquiries: 4, due: 4, repliedInTime: 1, salesConfirmed: 2 },
  flags: ["slow-replies", "paused"],
};
const names = new Map([["midrand", "Midrand"]]);

describe("the mentor dashboard (staff tools spec 2.6, plan decision 15)", () => {
  it("lists each shop with its badge, the 14 days' numbers and its flags, linking to its page", () => {
    render(<MentorDashboard rows={[tech]} showMentor={false} campusNames={names} />);
    const table = screen.getByRole("table", { name: "Your sellers, A to Z" });
    const [, row] = within(table).getAllByRole("row");
    expect(within(row).getByRole("link", { name: "Tech corner" })).toHaveAttribute("href", "/mentor/tech-corner");
    expect(within(row).getAllByRole("cell").map((cell) => cell.textContent)).toEqual([
      "ShopTech corner",
      "CampusMidrand",
      "BadgeResponsive",
      "Enquiries (14 days)4",
      "Replied within 48 hours1 of 4",
      "Sales confirmed (14 days)2",
      "FlagsSlow replies (under 50% in 48 hours), Shop paused",
    ]);
    expect(within(table).queryByRole("columnheader", { name: "Mentor" })).toBeNull();
  });

  it("names each shop's mentor for an admin, and offers the CSV as a download", () => {
    render(<MentorDashboard rows={[tech]} showMentor={true} campusNames={names} />);
    expect(screen.getByRole("table", { name: "Every mentored shop, A to Z" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Mentor" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "Naledi" })).toBeInTheDocument();
    const csv = screen.getByRole("link", { name: "Download CSV" });
    expect(csv).toHaveAttribute("href", "/mentor/export");
    expect(csv).toHaveAttribute("download");
  });

  it("says when no shop is assigned yet", () => {
    render(<MentorDashboard rows={[]} showMentor={false} campusNames={names} />);
    expect(
      screen.getByText("No shops are assigned to you yet. An admin assigns them on each shop's page."),
    ).toBeInTheDocument();
  });
});
