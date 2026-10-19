import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getCampuses, getCategories, getRequest } from "@/lib/data";
import { resetSampleStore } from "@/lib/data/store";
import { RequestView } from "./RequestView";

// The async listings are tested on their own; here they stand in (jsdom can't render async components in a tree).
vi.mock("./RelatedListings", () => ({ RelatedListings: () => <section aria-label="Already on Vossie, stood in" /> }));

// The session's links are async Server Components; here they're the signed-out links (messaging plan, Task 7).
vi.mock("@/components/messages/ViewerLinks", async () => (await import("@/tests/helpers/viewer-links")).signedOutViewerLinks);

// The offers panel's session part is an async Server Component; here it's the signed-out panel (community actions plan, Task 15).
vi.mock("@/components/looking-for/ViewerOffers", async () => (await import("@/tests/helpers/viewer-offers")).signedOutViewerOffers);

// Requests come from the sample store (community actions plan decision 1). A fresh one for each test.
beforeEach(() => {
  resetSampleStore();
});

async function show(id: string) {
  const [request, categories, campuses] = await Promise.all([getRequest(id), getCategories(), getCampuses()]);
  const category = categories.find((item) => item.slug === request!.categorySlug)!;
  return render(
    <RequestView
      request={request!}
      category={category}
      campusNames={new Map(campuses.map((campus) => [campus.slug, campus.name]))}
    />,
  );
}

const facts = (container: HTMLElement) =>
  within(container.querySelector<HTMLElement>(".request-facts")!)
    .getAllByRole("listitem")
    .map((item) => item.textContent);

describe("RequestView (community spec 4.2)", () => {
  it("leads with the breadcrumb and the title", async () => {
    await show("r-001");
    const crumbs = screen.getByRole("navigation", { name: "Breadcrumb" });
    expect(within(crumbs).getByRole("link", { name: "Looking For" })).toHaveAttribute("href", "/looking-for");
    expect(within(crumbs).getByRole("link", { name: "Tutoring" })).toHaveAttribute("href", "/looking-for?cat=tutoring");
    expect(screen.getByRole("heading", { level: 1, name: "Accounting 1 tutor this week" })).toBeInTheDocument();
  });

  it("lists the facts, naming the campus but never the asker (community spec decision 2)", async () => {
    const { container } = await show("r-001");
    expect(facts(container)).toEqual([
      "Midrand",
      "Tutoring",
      "Budget R300",
      "Needed by 16 Oct",
      "Posted 13 Oct",
      "Asked by a student at Midrand",
    ]);
    expect(container.querySelector('time[datetime="2026-10-16"]')).toHaveTextContent("16 Oct");
  });

  it("leaves Needed by out when there's no date", async () => {
    const { container } = await show("r-004");
    expect(facts(container)).toEqual([
      "Bedfordview",
      "Res & living",
      "Budget R1,200",
      "Posted 11 Oct",
      "Asked by a student at Bedfordview",
    ]);
  });

  it("keeps the asker's own words and line breaks", async () => {
    await show("r-001");
    expect(screen.getByText(/stuck on adjustments and the trial balance/)).toHaveClass("request-details");
  });

  it("counts the offers so far and offers to help, through the sign-in page to the composer", async () => {
    await show("r-001");
    const offers = screen.getByRole("region", { name: "Offers" });
    expect(within(offers).getByText("2 offers so far")).toBeInTheDocument();
    expect(within(offers).getByRole("link", { name: "Offer to help" })).toHaveAttribute(
      "href",
      "/login?next=%2Flooking-for%2Fr-001%2Foffer",
    );
  });

  it("invites the first offer", async () => {
    await show("r-004");
    expect(screen.getByText("No offers yet. Be the first.")).toBeInTheDocument();
  });

  it("says a closed request is closed, with no count and no button (plan decision 8)", async () => {
    await show("r-015");
    const offers = screen.getByRole("region", { name: "Offers" });
    expect(within(offers).getByText("This request is closed")).toBeInTheDocument();
    expect(screen.queryByText(/offers? so far/)).toBeNull();
    expect(screen.queryByRole("link", { name: "Offer to help" })).toBeNull();
  });

  it("shows listings already on Vossie, then a report link through the sign-in page", async () => {
    await show("r-001");
    expect(screen.getByRole("region", { name: "Already on Vossie, stood in" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Report this request" })).toHaveAttribute(
      "href",
      "/login?next=%2Freport%3Frequest%3Dr-001",
    );
  });
});
