import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { addFollow } from "@/lib/data/follows";
import { saveFormState } from "@/lib/data/form-states";
import { emptyDraft, saveOnboardingDraft } from "@/lib/data/shops";
import { declineShop, resendForApproval } from "@/lib/data/staff-shops";
import { resetSampleStore, sampleStore } from "@/lib/data/store";
import { DASHBOARD_FORM } from "@/lib/selling/form-state";
import { prefetchingLinks } from "@/tests/helpers/next-link";
import { SellHome } from "./SellHome";

const viewer = vi.hoisted(() => ({ id: null as string | null, sessionKey: null as string | null }));

// The session is the sample account named here; everything else is the real sample store.
vi.mock("@/lib/auth/session", async () => {
  const { getAccount } = await import("@/lib/data/accounts");
  return {
    getViewer: async () => (viewer.id ? getAccount(viewer.id) : null),
    getSessionKey: async () => viewer.sessionKey,
  };
});
vi.mock("next/server", async () => (await import("@/tests/helpers/next-request")).nextServer());
// next/link draws a plain <a> in jsdom; this one shows `prefetch` as data, for the test that checks every link.
vi.mock("next/link", async () => (await import("@/tests/helpers/next-link")).nextLinkShowingPrefetch);
vi.mock("@/lib/selling/shop-actions", () => ({
  pauseShop: async () => {},
  resumeShop: async () => {},
  sendForApprovalAgain: async () => {},
}));

beforeEach(() => {
  resetSampleStore();
  viewer.id = null;
  viewer.sessionKey = null;
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-14T10:00:00.000Z"));
});

/** What the last Pause my shop or Resume left in this browser's form state. */
const leaveNotice = (notice: string) =>
  saveFormState(
    { sessionKey: "s", form: DASHBOARD_FORM, errors: [], values: {}, notice, expiresAt: "2099-01-01T00:00:00.000Z" },
    new Date("2026-10-14T09:00:00.000Z"),
  );

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

  it("resumes at the first step not answered, and an Online student at the review (amendment 10.4)", async () => {
    viewer.id = "acc-student";
    const answered = { name: "Zola's Bakes", categorySlug: "food", about: "I bake between lectures." };
    // Midrand has pickup points to choose, and none is chosen yet: back to the photo step, then the points.
    await saveOnboardingDraft({ ...emptyDraft("acc-student", "midrand", new Date()), ...answered });
    const first = render(await SellHome());
    expect(screen.getByRole("link", { name: "Continue setting up your shop" })).toHaveAttribute(
      "href",
      "/sell/onboarding?step=3",
    );
    first.unmount();
    // Eduvos Online has none to choose, so everything is answered: straight to the review.
    await saveOnboardingDraft({ ...emptyDraft("acc-student", "online", new Date()), ...answered });
    render(await SellHome());
    expect(screen.getByRole("link", { name: "Continue setting up your shop" })).toHaveAttribute(
      "href",
      "/sell/onboarding?step=5",
    );
  });

  it("tells a seller waiting for approval that the Hub is checking their shop (spec 2.7)", async () => {
    viewer.id = "acc-pending";
    render(await SellHome());
    expect(screen.getByRole("heading", { level: 1, name: "The Hub is checking your shop" })).toBeInTheDocument();
    expect(screen.getByText(/You sent Crochet corner for approval on 10 October 2026\./)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "New listing" })).toHaveAttribute("href", "/sell/listings/new");
  });

  it("says when the shop was sent in one piece of text, so a line break in a new font can't make words jump (Task 17)", async () => {
    // React gives each {…} in a paragraph its own text node, and a node that starts mid-line counts as shifted when a
    // font swap moves it to the next line (layout shift 0.07 on a phone). One node starts where the paragraph does.
    viewer.id = "acc-pending";
    render(await SellHome());
    const lede = screen.getByText(/You sent Crochet corner for approval/);
    expect([...lede.childNodes].filter((node) => node.nodeType === Node.TEXT_NODE)).toHaveLength(1);
    expect(lede.childNodes).toHaveLength(1);
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

  it("tells the shop how many follow it, from the follows in the store (community actions spec 2.18)", async () => {
    viewer.id = "acc-seller";
    const first = render(await SellHome());
    expect(screen.getByText("No one follows your shop yet")).toBeInTheDocument();
    first.unmount();
    await addFollow("acc-student", "tech-corner", new Date("2026-10-14T08:42:00.000Z"));
    render(await SellHome());
    expect(screen.getByText("1 person follows your shop")).toBeInTheDocument();
  });

  it("says what the last action did once: a second visit shows no notice (amendment 10.6)", async () => {
    viewer.id = "acc-seller";
    viewer.sessionKey = "s";
    await leaveNotice("shop-resumed");
    const first = render(await SellHome());
    expect(screen.getByRole("status")).toHaveTextContent("Your shop is live again.");
    first.unmount();
    render(await SellHome());
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("never prefetches: the pitch, the waiting page and the dashboard have only links with prefetch off (amendment 10.7)", async () => {
    // The header, menu, footer and homepage prefetch /sell on every page, so nothing on it may prefetch in turn.
    for (const id of [null, "acc-student", "acc-pending", "acc-seller"]) {
      viewer.id = id;
      const { container, unmount } = render(await SellHome());
      expect(container.querySelectorAll("a[data-prefetch]").length, String(id)).toBeGreaterThan(0);
      expect(prefetchingLinks(container), String(id)).toEqual([]);
      unmount();
    }
  });

  it("shows a paused shop as paused, with Resume", async () => {
    viewer.id = "acc-seller";
    sampleStore().sellerProfiles.get("acc-seller")!.status = "paused";
    render(await SellHome());
    expect(screen.getByText("Paused: buyers can't see your listings")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Resume my shop" })).toHaveAttribute("type", "submit");
  });

  it("tells a declined seller the Hub's reason and how to send the shop again (staff tools plan decision 2)", async () => {
    await declineShop("crochet-corner", "acc-pending", "Add a photo of your work.", new Date("2026-10-14T08:00:00.000Z"));
    viewer.id = "acc-pending";
    render(await SellHome());
    expect(screen.getByRole("heading", { level: 1, name: "The Hub didn't approve your shop yet" })).toBeInTheDocument();
    expect(screen.getByText("Add a photo of your work.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send for approval again" })).toBeInTheDocument();
  });

  it("brings back the waiting page after Send for approval again, dated when it was sent again (amendment 6)", async () => {
    await declineShop("crochet-corner", "acc-pending", "Add a photo of your work.", new Date("2026-10-14T08:00:00.000Z"));
    await resendForApproval("acc-pending", new Date("2026-10-16T08:00:00.000Z"));
    viewer.id = "acc-pending";
    render(await SellHome());
    expect(screen.getByRole("heading", { level: 1, name: "The Hub is checking your shop" })).toBeInTheDocument();
    expect(screen.getByText(/You sent Crochet corner for approval on 16 October 2026\./)).toBeInTheDocument();
    expect(screen.queryByText("Add a photo of your work.")).toBeNull();
  });

  it("shows a shop the Hub paused with its reason, and no Resume (staff tools plan decision 3)", async () => {
    Object.assign(sampleStore().sellerProfiles.get("acc-seller")!, {
      status: "paused",
      pausedBy: "staff",
      staffReason: "Selling exam answers.",
    });
    viewer.id = "acc-seller";
    render(await SellHome());
    expect(screen.getByText("Paused by the Hub: buyers can't see your listings")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Why the Hub paused it" })).toHaveTextContent("Selling exam answers.");
    expect(screen.queryByRole("button", { name: "Resume my shop" })).toBeNull();
  });

  it("shows a shop the seller paused as theirs to resume, even with an old Hub reason on file", async () => {
    Object.assign(sampleStore().sellerProfiles.get("acc-seller")!, {
      status: "paused",
      pausedBy: "seller",
      staffReason: null,
    });
    viewer.id = "acc-seller";
    render(await SellHome());
    expect(screen.getByText("Paused: buyers can't see your listings")).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Why the Hub paused it" })).toBeNull();
    expect(screen.getByRole("button", { name: "Resume my shop" })).toBeInTheDocument();
  });

  it("never prefetches on a declined shop or one the Hub paused either (amendment 10.7)", async () => {
    await declineShop("crochet-corner", "acc-pending", "Add a photo of your work.", new Date("2026-10-14T08:00:00.000Z"));
    viewer.id = "acc-pending";
    const declined = render(await SellHome());
    expect(declined.container.querySelectorAll("a[data-prefetch]").length).toBeGreaterThan(0);
    expect(prefetchingLinks(declined.container)).toEqual([]);
    declined.unmount();
    Object.assign(sampleStore().sellerProfiles.get("acc-seller")!, { status: "paused", pausedBy: "staff", staffReason: "x" });
    viewer.id = "acc-seller";
    const paused = render(await SellHome());
    expect(paused.container.querySelectorAll("a[data-prefetch]").length).toBeGreaterThan(0);
    expect(prefetchingLinks(paused.container)).toEqual([]);
  });
});
