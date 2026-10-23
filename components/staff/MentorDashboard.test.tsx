import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { MentoredShop } from "@/lib/types";
import { MentorDashboard } from "./MentorDashboard";

const TODAY = "2026-10-14";
const DAYS = Array.from({ length: 14 }, (_, index) => `2026-10-${String(index + 1).padStart(2, "0")}`);

const shop = (overrides: Partial<MentoredShop>): MentoredShop => ({
  slug: "tech-corner",
  name: "Tech corner",
  campusSlug: "midrand",
  ownerName: "Sipho",
  ownerId: "acc-seller",
  badge: "responsive",
  status: "approved",
  pausedBy: null,
  mentorId: "acc-mentor",
  mentorName: "Naledi",
  counts: { enquiries: 11, due: 9, repliedInTime: 9, salesConfirmed: 1 },
  flags: [],
  lastCheckInOn: "2026-10-06",
  ...overrides,
});

const tech = shop({});
const lash = shop({
  slug: "lash-lounge",
  name: "Lash lounge",
  ownerId: "acc-lash",
  badge: null,
  counts: { enquiries: 0, due: 0, repliedInTime: 0, salesConfirmed: 0 },
  flags: ["no-listings"],
  lastCheckInOn: null,
});
const daily = new Map<string, (number | null)[]>([
  ["tech-corner", [0, 1, 0, 0, 2, 0, 0, 1, 0, 0, 0, 2, 5, 0]],
  ["lash-lounge", [null, null, null, null, null, null, null, null, null, null, null, null, 0, 0]],
]);

function show(props: Partial<Parameters<typeof MentorDashboard>[0]> = {}) {
  render(
    <MentorDashboard
      rows={[lash, tech]}
      view="needs"
      showMentor={false}
      campusNames={new Map([["midrand", "Midrand"]])}
      slotRequests={2}
      daily={daily}
      days={DAYS}
      today={TODAY}
      {...props}
    />,
  );
}

describe("the mentor caseload (role views spec 7.3)", () => {
  it("Needs you lists only the shops that need you, with their flags in words and a Due check-in", () => {
    show();
    const card = screen.getByRole("region", { name: "Your shops" });
    expect(within(card).getByText("1 of 2 need you · 2 slot requests")).toBeInTheDocument();
    const segments = within(card).getByRole("navigation", { name: "Which shops" });
    expect(within(segments).getByRole("link", { name: "Needs you (1)" })).toHaveAttribute("aria-current", "page");
    expect(within(segments).getByRole("link", { name: "All (2)" })).toHaveAttribute("href", "/mentor?view=all");
    const rows = within(screen.getByRole("list", { name: "Shops that need you" })).getAllByRole("link");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveAttribute("href", "/mentor/lash-lounge");
    expect(rows[0]).toHaveTextContent("Nothing is up for buyers yet");
    expect(rows[0]).toHaveTextContent("Check-in: Due");
  });

  it("All lists every shop, a quiet one with no flags and its check-in's age, with one chart each", () => {
    show({ view: "all" });
    const rows = within(screen.getByRole("list", { name: "All shops" })).getAllByRole("link");
    expect(rows.map((row) => row.getAttribute("href"))).toEqual(["/mentor/lash-lounge", "/mentor/tech-corner"]);
    expect(rows[1]).toHaveTextContent("No flags.");
    expect(rows[1]).toHaveTextContent("Check-in: 8 days ago");
    const chart = screen.getByRole("region", { name: "Enquiries, 14 days" });
    expect(within(chart).getByRole("img", { name: "Tech corner: 11 enquiries in 14 days, 0 today." })).toBeInTheDocument();
  });

  it("says All clear when no shop needs you, with the way to every shop and no chart", () => {
    show({ rows: [tech] });
    expect(screen.getByText(/^All clear/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "See all 1 shop" })).toHaveAttribute("href", "/mentor?view=all");
    expect(screen.queryByRole("region", { name: "Enquiries, 14 days" })).toBeNull();
  });
});
