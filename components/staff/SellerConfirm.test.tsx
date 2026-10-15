import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getShopForReview } from "@/lib/data/staff-shops";
import { resetSampleStore } from "@/lib/data/store";
import { SellerConfirm } from "./SellerConfirm";

vi.mock("@/lib/staff/admin-actions", () => ({ declineSeller: async () => {}, pauseSeller: async () => {} }));

beforeEach(() => {
  resetSampleStore();
});

describe("the sellers' confirm pages (staff tools spec 2.9, plan decision 18)", () => {
  it("asks before declining, saying the seller sees the reason and can send the shop again", async () => {
    render(<SellerConfirm kind="decline" review={(await getShopForReview("crochet-corner"))!} reason="" errors={[]} />);
    expect(screen.getByText("Decline Crochet corner? It won't be approved yet.")).toBeInTheDocument();
    expect(screen.getByText("Lerato sees your reason on their selling page, and gets a notification.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Decline Crochet corner" })).toHaveAttribute("type", "submit");
    expect(screen.getByRole("link", { name: "Keep it" })).toHaveAttribute("href", "/admin/sellers/crochet-corner");
  });

  it("asks before pausing, saying buyers stop seeing it and only the Hub can resume it", async () => {
    render(<SellerConfirm kind="pause" review={(await getShopForReview("tech-corner"))!} reason="" errors={[]} />);
    expect(screen.getByText("Pause Tech corner? Buyers stop seeing it straight away.")).toBeInTheDocument();
    expect(screen.getByText(/Only the Hub can resume it\.$/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pause Tech corner" })).toBeInTheDocument();
  });

  it("says when there's nothing to confirm, with the way back", async () => {
    render(<SellerConfirm kind="decline" review={(await getShopForReview("tech-corner"))!} reason="" errors={[]} />);
    expect(screen.getByText(/isn't waiting for approval/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to Tech corner" })).toHaveAttribute("href", "/admin/sellers/tech-corner");
    expect(screen.queryByRole("button")).toBeNull();
  });
});
