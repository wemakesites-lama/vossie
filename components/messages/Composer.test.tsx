import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetSampleStore } from "@/lib/data/store";
import { getAccount } from "@/lib/data/accounts";
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
