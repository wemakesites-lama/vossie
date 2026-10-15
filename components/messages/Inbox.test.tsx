import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { deleteAccountData } from "@/lib/data/accounts";
import { resetSampleStore } from "@/lib/data/store";
import { Inbox } from "./Inbox";

const session = vi.hoisted(() => ({ accountId: "acc-student" }));

vi.mock("@/lib/auth/session", () => ({
  requireAccount: async () => (await import("@/lib/data/accounts")).getAccount(session.accountId),
}));
vi.mock("next/server", async () => (await import("@/tests/helpers/next-request")).nextServer());

beforeEach(() => {
  resetSampleStore();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-14T08:42:00.000Z"));
});

afterEach(() => {
  session.accountId = "acc-student";
});

describe("the inbox for this visitor (messaging spec 2.10 and 3.2)", () => {
  it("shows a buyer's conversations, with no tabs when the account has no shop", async () => {
    render(await Inbox({ tab: "buying" }));
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(screen.queryByRole("navigation", { name: "Buying and selling" })).toBeNull();
  });

  it("shows Buying, not Selling, when an account without a shop asks for Selling (plan decision 22)", async () => {
    render(await Inbox({ tab: "selling" }));
    expect(screen.getByRole("region", { name: "Buying" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Refresh" })).toHaveAttribute("href", "/messages");
  });

  it("shows a seller's enquiries under Selling", async () => {
    session.accountId = "acc-seller";
    render(await Inbox({ tab: "selling" }));
    expect(screen.getByRole("link", { name: "Selling" })).toHaveAttribute("aria-current", "page");
    expect(screen.getAllByText("Thandi")).toHaveLength(2);
  });

  it("names a buyer who has left as \"Deleted account\" (messaging plan amendment 3.9)", async () => {
    await deleteAccountData("acc-student");
    session.accountId = "acc-seller";
    render(await Inbox({ tab: "selling" }));
    expect(screen.getAllByText("Deleted account")).toHaveLength(2);
    expect(screen.queryByText("Thandi")).toBeNull();
  });
});
