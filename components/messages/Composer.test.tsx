import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetSampleStore } from "@/lib/data/store";
import { getAccount } from "@/lib/data/accounts";
import { startConversation } from "@/lib/data/messages";
import { composerSubject } from "@/lib/messaging/subjects";
import { Composer } from "./Composer";

const session = vi.hoisted(() => ({ accountId: "acc-mentor" }));

vi.mock("@/lib/auth/session", () => ({
  requireAccount: async () => (await import("@/lib/data/accounts")).getAccount(session.accountId),
}));
vi.mock("@/lib/auth/form-state", () => ({ readFormState: async () => null }));
vi.mock("next/navigation", async () => (await import("@/tests/helpers/next-request")).nextNavigation());
vi.mock("@/lib/messaging/actions", () => ({ sendFirstMessage: async () => {} }));

beforeEach(() => {
  resetSampleStore();
});

afterEach(() => {
  session.accountId = "acc-mentor";
});

describe("the composer for this visitor (messaging spec 3.1, plan decision 5)", () => {
  it("shows the form to someone who hasn't messaged about the listing", async () => {
    render(await Composer({ target: { kind: "listing", listingId: "l-001" } }));
    expect(screen.getByRole("button", { name: "Send" })).toBeInTheDocument();
  });

  it("points to the conversation the visitor already has", async () => {
    session.accountId = "acc-student";
    render(await Composer({ target: { kind: "listing", listingId: "l-001" } }));
    expect(screen.getByRole("link", { name: "Open the conversation" })).toHaveAttribute("href", "/messages/conv-s2");
  });

  it("offers the conversation first, even when the listing has since been sold (messaging plan amendment 6)", async () => {
    // l-026 is sold. Someone who asked about it before it sold gets their conversation, not "isn't available".
    const target = { kind: "listing", listingId: "l-026" } as const;
    const subject = (await composerSubject(target))!;
    expect(subject.open).toBe(false);
    const { conversationId } = await startConversation({
      buyerId: "acc-mentor",
      listing: { id: "l-026", title: subject.listing!.title },
      sellerSlug: subject.seller.slug,
      body: "Is it still available?",
      swapOffer: null,
      now: new Date("2026-10-09T08:00:00.000Z"),
    });
    const { unmount } = render(await Composer({ target }));
    expect(screen.getByText(`You've already messaged ${subject.seller.name} about this.`)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open the conversation" })).toHaveAttribute(
      "href",
      `/messages/${conversationId}`,
    );
    expect(screen.queryByText(/isn't available/)).toBeNull();
    unmount();
    // Anyone else still hears that it can't be messaged.
    session.accountId = "acc-student";
    render(await Composer({ target }));
    expect(screen.getByText("This listing isn't available right now, so it can't be messaged.")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Open the conversation" })).toBeNull();
  });

  it("tells a seller their own listing and shop can't be messaged", async () => {
    session.accountId = "acc-seller";
    expect((await getAccount("acc-seller"))?.seller?.sellerSlug).toBe("tech-corner");
    const { unmount } = render(await Composer({ target: { kind: "listing", listingId: "l-001" } }));
    expect(screen.getByText("This is your listing, so you can't message yourself.")).toBeInTheDocument();
    unmount();
    render(await Composer({ target: { kind: "shop", sellerSlug: "tech-corner" } }));
    expect(screen.getByText("This is your shop, so you can't message yourself.")).toBeInTheDocument();
  });

  it("is the 404 for a listing or shop that doesn't exist", async () => {
    await expect(Composer({ target: { kind: "listing", listingId: "l-nope" } })).rejects.toThrow("notFound");
    await expect(Composer({ target: { kind: "shop", sellerSlug: "nope" } })).rejects.toThrow("notFound");
  });
});
