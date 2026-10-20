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
    render(<SellerConfirm kind="decline" review={(await getShopForReview("crochet-corner"))!} own={false} onlyAdmin={false} reason="" errors={[]} />);
    expect(screen.getByText("Decline Crochet corner? It won't be approved yet.")).toBeInTheDocument();
    expect(screen.getByText("Lerato sees your reason on their selling page, and gets a notification.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Decline Crochet corner" })).toHaveAttribute("type", "submit");
    // The shop and the owner that were reviewed (amendment 14.6).
    expect(document.querySelector('input[name="shop"]')).toHaveValue("crochet-corner");
    expect(document.querySelector('input[name="owner"]')).toHaveValue("acc-pending");
    expect(screen.getByRole("link", { name: "Keep it" })).toHaveAttribute("href", "/admin/sellers/crochet-corner");
  });

  it("asks before pausing, saying buyers stop seeing it and only the Hub can resume it", async () => {
    render(<SellerConfirm kind="pause" review={(await getShopForReview("tech-corner"))!} own={false} onlyAdmin={false} reason="" errors={[]} />);
    expect(screen.getByText("Pause Tech corner? Buyers stop seeing it straight away.")).toBeInTheDocument();
    expect(screen.getByText(/Only the Hub can resume it\.$/)).toBeInTheDocument();
    expect(
      screen.getByText("Every open report about the shop or its listings closes, and each reporter hears that the Hub acted."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pause Tech corner" })).toBeInTheDocument();
  });

  it("says when there's nothing to confirm, with the way back", async () => {
    render(<SellerConfirm kind="decline" review={(await getShopForReview("tech-corner"))!} own={false} onlyAdmin={false} reason="" errors={[]} />);
    expect(screen.getByText(/isn't waiting for approval/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to Tech corner" })).toHaveAttribute("href", "/admin/sellers/tech-corner");
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("says why for the admin's own shop, with no form, and the way back (stage L spec section 3)", async () => {
    render(
      <SellerConfirm kind="pause" review={(await getShopForReview("tech-corner"))!} own onlyAdmin reason="" errors={[]} />,
    );
    expect(screen.getByText(/^This is your own shop, so another admin must make the Hub's decisions/)).toBeInTheDocument();
    expect(screen.getByText("You're the only admin. Give someone else the Admin role in Staff first.")).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.getByRole("link", { name: "Back to Tech corner" })).toHaveAttribute("href", "/admin/sellers/tech-corner");
  });
});
