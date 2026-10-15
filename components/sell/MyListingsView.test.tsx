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
  render(<MyListingsView tab={tab} rows={rows} waiting={false} notice={null} noticeListing={null} {...extra} />);

// Each row's buttons name the listing too (in sr-only text), so find the row by its title line.
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

  it("posts each row's listing id and the move it asks for", () => {
    show("available");
    const forms = [...itemFor("Desk fan").querySelectorAll("form")];
    expect(
      forms.map((form) => [
        form.querySelector<HTMLInputElement>('input[name="listing"]')?.value,
        form.querySelector<HTMLInputElement>('input[name="to"]')?.value,
      ]),
    ).toEqual([
      ["l-a", "paused"],
      ["l-a", "sold"],
    ]);
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
    expect(screen.getByRole("link", { name: "Delete Bike" })).toBeInTheDocument();
  });

  it("says when a tab is empty", () => {
    render(<MyListingsView tab="sold" rows={[]} waiting={false} notice={null} noticeListing={null} />);
    expect(screen.getByText("Nothing sold yet.")).toBeInTheDocument();
  });

  it("shows the last action's notice with a link to the listing, and tells a waiting shop its listings are drafts", () => {
    show("available", { notice: "Published. Buyers can find it now.", noticeListing: "l-a", waiting: true });
    const notice = screen.getByRole("status");
    expect(notice).toHaveTextContent("Published. Buyers can find it now.");
    expect(within(notice).getByRole("link", { name: "See it as buyers do" })).toHaveAttribute("href", "/listings/l-a");
    expect(screen.getByText(/Your shop is waiting for the Hub/)).toBeInTheDocument();
  });

  it("links no page for a draft's notice, which buyers can't see", () => {
    show("drafts", { notice: "Saved as a draft. Only you can see it.", noticeListing: "l-d" });
    expect(within(screen.getByRole("status")).queryByRole("link")).toBeNull();
  });
});
