import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { declineShop, listShopsForReview } from "@/lib/data/staff-shops";
import { resetSampleStore } from "@/lib/data/store";
import { AdminSellers } from "./AdminSellers";

const names = new Map([
  ["midrand", "Midrand"],
  ["pretoria", "Pretoria"],
]);

beforeEach(() => {
  resetSampleStore();
});

describe("the Sellers list (staff tools spec 2.3)", () => {
  it("lists shops waiting for approval first, each with its campus, date and a Review link naming it", async () => {
    render(<AdminSellers rows={await listShopsForReview()} campusNames={names} />);
    const waiting = screen.getByRole("table", { name: "Shops waiting for approval, oldest first" });
    const [, crochet] = within(waiting).getAllByRole("row");
    expect(within(crochet).getByRole("cell", { name: "Pretoria" })).toBeInTheDocument();
    expect(within(crochet).getByRole("cell", { name: "10 Oct" })).toBeInTheDocument();
    expect(within(crochet).getByRole("cell", { name: "Waiting" })).toBeInTheDocument();
    expect(within(crochet).getByRole("link", { name: "Review Crochet corner" })).toHaveAttribute(
      "href",
      "/admin/sellers/crochet-corner",
    );
    const every = screen.getByRole("table", { name: "Open and paused shops, A to Z" });
    expect(within(every).getAllByRole("row")).toHaveLength(30);
    const tech = within(every).getByRole("link", { name: "Review Tech corner" }).closest("tr")!;
    expect(within(tech as HTMLElement).getByRole("cell", { name: "Sipho" })).toBeInTheDocument();
  });

  it("says when a shop was declined, and when nobody is waiting", async () => {
    await declineShop("crochet-corner", "acc-pending", "Add a photo of your work.", new Date("2026-10-14T08:42:00.000Z"));
    const { unmount } = render(<AdminSellers rows={await listShopsForReview()} campusNames={names} />);
    expect(screen.getByRole("cell", { name: "Declined on 14 Oct" })).toBeInTheDocument();
    unmount();
    render(<AdminSellers rows={(await listShopsForReview()).filter((row) => row.owner === null)} campusNames={names} />);
    expect(screen.getByText("Nobody is waiting for approval.")).toBeInTheDocument();
  });
});
