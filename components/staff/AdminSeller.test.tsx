import { readFileSync } from "node:fs";
import { join } from "node:path";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { declineShop, getShopForReview } from "@/lib/data/staff-shops";
import { resetSampleStore, sampleStore } from "@/lib/data/store";
import { AdminSeller } from "./AdminSeller";

// The forms only need something to post to; the actions have their own tests.
vi.mock("@/lib/staff/admin-actions", () => ({
  approveSeller: async () => {},
  verifySeller: async () => {},
  resumeSeller: async () => {},
  assignMentor: async () => {},
}));

beforeEach(() => {
  resetSampleStore();
});

async function show(slug: string) {
  render(
    <AdminSeller
      review={(await getShopForReview(slug))!}
      campusName="Midrand"
      categoryName="Tech"
      pointNames={["Library entrance", "Main reception"]}
      mentors={[{ id: "acc-mentor", firstName: "Naledi" }]}
    />,
  );
}

describe("a shop's review page (staff tools spec 2.3)", () => {
  it("shows a waiting shop's answers, with Approve and Decline naming it, and no mentor yet", async () => {
    await show("crochet-corner");
    expect(screen.getByText("Waiting for approval since 10 October 2026.")).toBeInTheDocument();
    expect(screen.getByText("Beanies, bags and bucket hats, made by hand.")).toBeInTheDocument();
    expect(screen.getByText("Library entrance, Main reception")).toBeInTheDocument();
    expect(screen.getByText("Lerato")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Approve Crochet corner" })).toHaveAttribute("type", "submit");
    expect(document.querySelector('form input[name="shop"]')).toHaveValue("crochet-corner");
    // The owner reviewed is posted with it, so a different shop on the link isn't approved by mistake (amendment 14.6).
    expect(document.querySelector('form input[name="owner"]')).toHaveValue("acc-pending");
    expect(screen.getByRole("link", { name: "Decline Crochet corner" })).toHaveAttribute(
      "href",
      "/admin/sellers/crochet-corner/decline",
    );
    expect(screen.queryByRole("region", { name: "Mentor" })).toBeNull();
  });

  it("shows a declined shop's reason, with nothing to do until the seller sends it again", async () => {
    await declineShop("crochet-corner", "acc-pending", "Add a photo of your work.", new Date("2026-10-14T08:42:00.000Z"));
    await show("crochet-corner");
    expect(screen.getByText(/^Declined on 14 October 2026\. The seller sees your reason:/)).toHaveTextContent(
      "Add a photo of your work.",
    );
    expect(screen.getByText("Nothing to do until the seller sends it again.")).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("gives an open shop Verify, Pause, its storefront and its mentor", async () => {
    await show("tech-corner");
    expect(screen.getByText("Open.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Verify Tech corner" })).toBeInTheDocument();
    expect(document.querySelector('input[name="verified"]')).toHaveValue("yes");
    expect(screen.getByRole("link", { name: "Pause Tech corner" })).toHaveAttribute(
      "href",
      "/admin/sellers/tech-corner/pause",
    );
    expect(screen.getByRole("link", { name: "See Tech corner's storefront" })).toHaveAttribute(
      "href",
      "/sellers/tech-corner",
    );
    expect(screen.getByRole("combobox", { name: "Mentor for Tech corner" })).toHaveValue("acc-mentor");
    expect(screen.getByRole("button", { name: "Save mentor for Tech corner" })).toBeInTheDocument();
  });

  it("shows the Hub's pause with its reason, and Resume instead of Pause", async () => {
    Object.assign(sampleStore().sellerProfiles.get("acc-seller")!, {
      status: "paused",
      pausedBy: "staff",
      staffReason: "Selling exam answers.",
    });
    await show("tech-corner");
    expect(screen.getByText(/^Paused by the Hub\. The seller sees your reason:/)).toHaveTextContent(
      "Selling exam answers.",
    );
    expect(screen.getByRole("button", { name: "Resume Tech corner" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Pause Tech corner" })).toBeNull();
    expect(screen.queryByRole("link", { name: "See Tech corner's storefront" })).toBeNull();
    expect(screen.getByText("Buyers can't see Tech corner while the Hub's pause lasts.")).toBeInTheDocument();
  });

  it("keeps the storefront link for a shop the seller paused", async () => {
    Object.assign(sampleStore().sellerProfiles.get("acc-seller")!, { status: "paused", pausedBy: "seller" });
    await show("tech-corner");
    expect(screen.getByRole("link", { name: "See Tech corner's storefront" })).toBeInTheDocument();
    expect(screen.queryByText(/while the Hub's pause lasts/)).toBeNull();
  });

  it("styles the link in the facts like the other staff links, so it looks like one (amendment 14.5)", () => {
    const css = readFileSync(join(process.cwd(), "app/globals.css"), "utf8");
    const start = css.indexOf(".staff-body p a:not(.btn)");
    expect(start).toBeGreaterThan(-1);
    const selectors = css
      .slice(start, css.indexOf("{", start))
      .split(",")
      .map((selector) => selector.trim());
    expect(selectors).toContain(".staff-facts dd a:not(.btn):not(.link-button)");
  });

  it("says a sample shop can't be paused, offers Remove Verified, and has no mentor", async () => {
    await show("hair-studio");
    expect(screen.getByText("A sample shop no account owns can't be paused.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove Verified from Hair studio" })).toBeInTheDocument();
    expect(screen.getByText("A sample shop no account owns")).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Mentor" })).toBeNull();
  });
});
