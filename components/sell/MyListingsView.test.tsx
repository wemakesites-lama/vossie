import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ListingsTab } from "@/lib/types";
import { makeListingRow } from "@/tests/helpers/fakes";
import { MyListingsView } from "./MyListingsView";

// The buttons only need something to post to; the actions have their own tests.
vi.mock("@/lib/selling/listing-actions", () => ({ changeListingState: async () => {} }));

const rows = [
  makeListingRow({ id: "l-a", title: "Desk fan", state: "available", priceZar: 150, updatedAt: "2026-10-13T08:00:00.000Z" }),
  makeListingRow({ id: "l-p", title: "Kettle", state: "paused" }),
  makeListingRow({ id: "l-s", title: "Lamp", state: "sold" }),
  makeListingRow({ id: "l-d", title: "Bike", state: "draft" }),
];

const show = (tab: ListingsTab, extra: Partial<Parameters<typeof MyListingsView>[0]> = {}) =>
  render(
    <MyListingsView tab={tab} rows={rows} waiting={false} paused={false} notice={null} noticeListing={null} {...extra} />,
  );

// The title is also in each control's sr-only name, so look for the one in the listing's own line.
const itemFor = (title: string) => screen.getByText(title, { selector: ".sell-item-title" }).closest("li")!;

describe("My listings (selling spec 2.9)", () => {
  it("links each tab with its count, marking the open one", () => {
    show("available");
    const tabs = within(screen.getByRole("navigation", { name: "Listings by state" })).getAllByRole("link");
    expect(tabs.map((tab) => [tab.textContent, tab.getAttribute("href"), tab.getAttribute("aria-current")])).toEqual([
      ["Available (1)", "/sell/listings", "page"],
      ["Paused (1)", "/sell/listings?tab=paused", null],
      ["Sold (1)", "/sell/listings?tab=sold", null],
      ["Drafts (1)", "/sell/listings?tab=drafts", null],
    ]);
  });

  it("shows an available listing's price and last update, and actions that each name it", () => {
    show("available");
    const item = itemFor("Desk fan");
    expect(within(item).getByText("R150 · Updated 13 Oct")).toBeInTheDocument();
    expect(within(item).getByRole("link", { name: "Edit Desk fan" })).toHaveAttribute("href", "/sell/listings/l-a/edit");
    expect(within(item).getByRole("button", { name: "Pause Desk fan" })).toHaveAttribute("type", "submit");
    expect(within(item).getByRole("button", { name: "Mark sold Desk fan" })).toBeInTheDocument();
    expect(within(item).getByRole("link", { name: "Delete Desk fan" })).toHaveAttribute("href", "/sell/listings/l-a/delete");
    expect(item.querySelector('input[name="tab"]')).toHaveValue("available");
    expect(screen.queryByText("Kettle")).toBeNull();
  });

  it("offers Resume on a paused listing, Relist on a sold one, and only Edit and Delete on a draft", () => {
    const paused = show("paused");
    expect(screen.getByRole("button", { name: "Resume Kettle" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mark sold Kettle" })).toBeInTheDocument();
    paused.unmount();
    const sold = show("sold");
    expect(screen.getByRole("button", { name: "Relist Lamp" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Mark sold/ })).toBeNull();
    sold.unmount();
    show("drafts");
    expect(screen.queryAllByRole("button")).toEqual([]);
    expect(screen.getByRole("link", { name: "Edit Bike" })).toBeInTheDocument();
  });

  it("says when a tab is empty", () => {
    render(<MyListingsView tab="sold" rows={[]} waiting={false} paused={false} notice={null} noticeListing={null} />);
    expect(screen.getByText("Nothing sold yet.")).toBeInTheDocument();
  });

  it("shows the last action's notice with a link to the listing, and tells a waiting shop its listings are drafts", () => {
    show("available", { notice: "Published. Buyers can find it now.", noticeListing: "l-a", waiting: true });
    const notice = screen.getByRole("status");
    expect(notice).toHaveTextContent("Published. Buyers can find it now.");
    expect(within(notice).getByRole("link", { name: "See it as buyers do" })).toHaveAttribute("href", "/listings/l-a");
    expect(screen.getByText(/Your shop is waiting for the Hub/)).toBeInTheDocument();
    expect(screen.queryByText(/Your shop is paused/)).toBeNull();
  });

  it("tells a paused shop buyers can't see its listings, and offers no look as a buyer (amendment 11.6)", () => {
    const notice = "Saved. Your shop is paused, so buyers will see it when you resume your shop.";
    show("available", { paused: true, notice, noticeListing: "l-a" });
    expect(screen.getByRole("status")).toHaveTextContent(notice);
    expect(screen.queryByRole("link", { name: "See it as buyers do" })).toBeNull();
    expect(
      screen.getByText("Your shop is paused, so buyers can't see your listings until you resume it."),
    ).toBeInTheDocument();
  });

  it("tells a seller the Hub paused the shop, with the Hub's reason and no promise they can resume it (staff tools plan decision 3)", () => {
    show("available", { paused: true, hubPause: "Selling exam answers." });
    const banner = screen.getByText(/^Paused by the Hub: buyers can't see your listings\./);
    expect(banner).toHaveTextContent("The Hub said: Selling exam answers.");
    expect(banner).not.toHaveTextContent(/until you resume/);
    expect(screen.queryByText(/Your shop is paused/)).toBeNull();
  });

  it("still says the Hub paused it when the Hub gave no reason, and offers no look as a buyer", () => {
    show("available", { paused: true, hubPause: "", notice: "Saved.", noticeListing: "l-a" });
    expect(screen.getByText("Paused by the Hub: buyers can't see your listings.")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "See it as buyers do" })).toBeNull();
  });

  it("keeps the seller's own pause words when the Hub didn't pause it", () => {
    show("available", { paused: true, hubPause: null });
    expect(
      screen.getByText("Your shop is paused, so buyers can't see your listings until you resume it."),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Paused by the Hub/)).toBeNull();
  });

  it("marks a listing the Hub hid, with the Hub's reason (staff tools plan decision 4)", () => {
    const hidden = makeListingRow({ hiddenAt: "2026-10-14T08:00:00.000Z", hiddenReason: "Exam papers aren't allowed." });
    render(<MyListingsView tab="available" rows={[hidden]} waiting={false} paused={false} notice={null} noticeListing={null} />);
    expect(screen.getByText("Hidden by the Hub: Exam papers aren't allowed.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Edit Test listing" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Delete Test listing" })).toBeInTheDocument();
  });

  it("says nothing about the Hub on a listing it didn't hide, and doesn't need a reason to mark one", () => {
    const { rerender } = show("available");
    expect(screen.queryByText(/Hidden by the Hub/)).toBeNull();
    rerender(
      <MyListingsView
        tab="available"
        rows={[makeListingRow({ hiddenAt: "2026-10-14T08:00:00.000Z" })]}
        waiting={false}
        paused={false}
        notice={null}
        noticeListing={null}
      />,
    );
    expect(screen.getByText("Hidden by the Hub: no reason given")).toBeInTheDocument();
  });

  // Next treats /sell/listings and /sell/listings?tab=paused as one page, so a kept page's rows meet the next tab's
  // (selling plan amendment 2). Rows are keyed by their listing, so none of them, or their forms, carries over.
  it("carries nothing over when the same page is shown for another tab", () => {
    const { rerender } = show("available");
    const fan = itemFor("Desk fan");
    rerender(
      <MyListingsView tab="paused" rows={rows} waiting={false} paused={false} notice={null} noticeListing={null} />,
    );
    expect(fan.isConnected).toBe(false);
    expect(screen.queryByText("Desk fan")).toBeNull();
    expect(itemFor("Kettle").querySelector('input[name="tab"]')).toHaveValue("paused");
  });
});
