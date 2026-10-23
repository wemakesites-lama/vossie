import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { dayMonth } from "@/lib/format";
import type { Account } from "@/lib/types";
import { forYouItems, type ForYou, type YourStuff } from "@/lib/you/model";
import { YouView } from "./AccountView";

// next/link draws a plain <a> in jsdom; this one shows `prefetch` as data, for the tests that check it.
vi.mock("next/link", async () => (await import("@/tests/helpers/next-link")).nextLinkShowingPrefetch);

const account: Account = {
  id: "acc-student",
  email: "student@eduvos.com",
  firstName: "Thandi",
  campusSlug: "midrand",
  roles: [],
  seller: null,
  createdAt: "2026-09-01T07:30:00.000Z",
};

const quiet: ForYou = { items: forYouItems({ conversations: 0, byKind: {} }), conversations: 0, newNotifications: 0 };
const busy: ForYou = {
  items: forYouItems({
    conversations: 2,
    byKind: { "search-match": { count: 1, newestHref: "/listings/l-001", newestText: "A calculator matches your search" } },
  }),
  conversations: 2,
  newNotifications: 3,
};
const empty: YourStuff = {
  savedListings: 0,
  followedShops: 0,
  requests: { open: 0, closed: 0, hidden: 0 },
  closingSoon: null,
  searches: { count: 0, alertsOn: 0 },
  bookings: [],
};

function renderYou({
  who = account,
  forYou = quiet,
  stuff = empty,
}: { who?: Account; forYou?: ForYou | null; stuff?: YourStuff | null } = {}) {
  return render(<YouView account={who} campusName="Midrand" forYou={forYou} stuff={stuff} />);
}

/** A card's rows as [title, address]. */
function rowsIn(card: string) {
  return within(screen.getByRole("region", { name: card }))
    .getAllByRole("link")
    .map((link) => [link.querySelector(".list-row-title")?.textContent, link.getAttribute("href")]);
}

describe("You (role views spec 7.4)", () => {
  it("greets the student by first name, with their campus", () => {
    renderYou();
    expect(screen.getByRole("heading", { level: 1, name: "Hi, Thandi" })).toBeInTheDocument();
    expect(screen.getByText("Midrand")).toBeInTheDocument();
  });

  it("lists only what's waiting, each one link", () => {
    renderYou({ forYou: busy });
    const list = screen.getByRole("list", { name: "For you" });
    const links = within(list).getAllByRole("link");
    expect(links.map((link) => link.getAttribute("href"))).toEqual(["/messages", "/notifications"]);
    expect(links[0]).toHaveAccessibleName(/2\s*Conversations with new messages/);
    expect(links[1]).toHaveAccessibleName(/1\s*New match for your saved searches\s*A calculator matches your search/);
  });

  it("lists Your stuff in order, the Messages and Notifications rows counting from For you", () => {
    renderYou({ forYou: busy });
    expect(rowsIn("Your stuff")).toEqual([
      ["Messages", "/messages"],
      ["Notifications", "/notifications"],
      ["Saved", "/saved"],
      ["Your requests", "/account/requests"],
      ["Saved searches", "/saved?tab=searches"],
      ["Hub bookings", "/hub"],
    ]);
    expect(screen.getByRole("link", { name: /^Messages\s+2 unread$/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /^Notifications\s+3 new$/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /^Saved\s+0 listings on this device · 0 shops followed$/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /^Hub bookings\s+Nothing coming up$/ })).toBeInTheDocument();
  });

  it("never prefetches a row (decision 53; staff pages read the session)", () => {
    renderYou({ who: { ...account, roles: ["admin"], seller: { status: "approved", sellerSlug: "tech-corner" } } });
    for (const link of within(screen.getByRole("region", { name: "Your stuff" })).getAllByRole("link")) {
      expect(link.dataset.prefetch, link.textContent ?? "").toBe("false");
    }
  });

  it("shows Your shop only to a seller, with where it stands (plan decision 5)", () => {
    const student = renderYou();
    expect(screen.queryByRole("link", { name: /^Your shop/ })).toBeNull();
    expect(screen.queryByRole("link", { name: /Start selling/ })).toBeNull();
    student.unmount();
    const waiting = renderYou({ who: { ...account, seller: { status: "pending", sellerSlug: null } } });
    expect(screen.getByRole("link", { name: /^Your shop\s+Waiting for the Hub's approval$/ })).toHaveAttribute("href", "/sell");
    waiting.unmount();
    renderYou({ who: { ...account, seller: { status: "paused", sellerSlug: "tech-corner" } } });
    expect(screen.getByRole("link", { name: /^Your shop\s+Paused$/ })).toHaveAttribute("href", "/sell");
  });

  it("gives staff their tools by role, after Your shop (plan decision 6)", () => {
    const admin = renderYou({ who: { ...account, roles: ["admin"] } });
    expect(rowsIn("Your stuff").slice(6)).toEqual([
      ["Hub console", "/admin"],
      ["Hub posts and office hours", "/hub/manage"],
      ["Mentor dashboard", "/mentor"],
    ]);
    admin.unmount();
    renderYou({ who: { ...account, roles: ["mentor"] } });
    expect(rowsIn("Your stuff").slice(6)).toEqual([
      ["Hub posts and office hours", "/hub/manage"],
      ["Mentor dashboard", "/mentor"],
    ]);
  });

  it("warns when a request closes soon, linking to Your requests (plan decision 8)", () => {
    renderYou({ stuff: { ...empty, requests: { open: 1, closed: 0, hidden: 0 }, closingSoon: { title: "Desk lamp", closesOn: "2026-10-24", count: 1 } } });
    expect(screen.getByText(`Your request Desk lamp closes automatically on ${dayMonth("2026-10-24")}.`, { exact: false })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Your requests" })).toHaveAttribute("href", "/account/requests");
  });

  it("ends with Settings: Your details, Privacy and Sign out", () => {
    renderYou();
    expect(rowsIn("Settings")).toEqual([
      ["Your details", "/account/details"],
      ["Privacy", "/account/privacy"],
    ]);
    const signOut = screen.getByRole("button", { name: "Sign out" });
    expect(signOut).toHaveAttribute("type", "submit");
    expect(signOut.closest("form")).toHaveAttribute("action", "/logout");
    expect(signOut.closest("form")).toHaveAttribute("method", "post");
  });

  it("keeps working when a reader fails: that card says so, the rest stays (role views spec 8)", () => {
    renderYou({ forYou: null, stuff: null });
    expect(within(screen.getByRole("region", { name: "For you" })).getByText("For you didn't load.")).toBeInTheDocument();
    const stuff = screen.getByRole("region", { name: "Your stuff" });
    expect(within(stuff).getByRole("link", { name: "Messages" })).toHaveAttribute("href", "/messages");
    expect(within(stuff).getByText("Your saved things, requests and bookings didn't load.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign out" })).toBeInTheDocument();
  });
});
