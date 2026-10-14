import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { emptyDraft, saveOnboardingDraft } from "@/lib/data/shops";
import { resetSampleStore, sampleStore } from "@/lib/data/store";
import { SellHome } from "./SellHome";

const viewer = vi.hoisted(() => ({ id: null as string | null }));

// The session is the sample account named here; everything else is the real sample store.
vi.mock("@/lib/auth/session", async () => {
  const { getAccount } = await import("@/lib/data/accounts");
  return { getViewer: async () => (viewer.id ? getAccount(viewer.id) : null), getSessionKey: async () => null };
});
vi.mock("next/server", async () => (await import("@/tests/helpers/next-request")).nextServer());
vi.mock("@/lib/selling/shop-actions", () => ({ pauseShop: async () => {}, resumeShop: async () => {} }));

beforeEach(() => {
  resetSampleStore();
  viewer.id = null;
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-14T10:00:00.000Z"));
});

describe("/sell (selling spec section 3)", () => {
  it("pitches to a signed-out visitor, with Start selling through sign-in to the wizard", async () => {
    render(await SellHome());
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Turn your hustle into a campus-wide business");
    expect(screen.getByRole("link", { name: "Start selling" })).toHaveAttribute("href", "/login?next=%2Fsell%2Fonboarding");
  });

  it("sends a signed-in student without a shop to the wizard, or back to where they stopped", async () => {
    viewer.id = "acc-student";
    const first = render(await SellHome());
    expect(screen.getByRole("link", { name: "Start selling" })).toHaveAttribute("href", "/sell/onboarding");
    first.unmount();
    const draft = emptyDraft("acc-student", "midrand", new Date());
    await saveOnboardingDraft({ ...draft, name: "Zola's Bakes", categorySlug: "food" });
    render(await SellHome());
    expect(screen.getByRole("link", { name: "Continue setting up your shop" })).toHaveAttribute(
      "href",
      "/sell/onboarding?step=2",
    );
  });

  it("tells a seller waiting for approval that the Hub is checking their shop (spec 2.7)", async () => {
    viewer.id = "acc-pending";
    render(await SellHome());
    expect(screen.getByRole("heading", { level: 1, name: "The Hub is checking your shop" })).toBeInTheDocument();
    expect(screen.getByText(/You sent Crochet corner for approval on 10 October 2026\./)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "New listing" })).toHaveAttribute("href", "/sell/listings/new");
  });

  it("shows an approved seller the dashboard: this week's numbers and the next badge (spec 2.8)", async () => {
    viewer.id = "acc-seller";
    render(await SellHome());
    expect(screen.getByRole("heading", { level: 1, name: "Tech corner" })).toBeInTheDocument();
    expect(screen.getByText("Your shop is live")).toBeInTheDocument();
    const week = screen.getByRole("region", { name: "In the last 7 days" });
    expect(within(week).getByText("New enquiries").nextElementSibling).toHaveTextContent("2");
    expect(within(week).getByText("Replied within 48 hours").nextElementSibling).toHaveTextContent("2 of 2");
    expect(within(week).getByText("Sales confirmed").nextElementSibling).toHaveTextContent("0");
    expect(screen.getByText("1 more enquiry and 5 more confirmed sales for Trusted.")).toBeInTheDocument();
  });

  it("shows a paused shop as paused, with Resume", async () => {
    viewer.id = "acc-seller";
    sampleStore().sellerProfiles.get("acc-seller")!.status = "paused";
    render(await SellHome());
    expect(screen.getByText("Paused: buyers can't see your listings")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Resume my shop" })).toHaveAttribute("type", "submit");
  });
});
